#!/usr/bin/env ruby
# Adds the BTTSShare Share Extension target ("Add to BTTS") to the Capacitor-
# generated Xcode project, embedded in the app's PlugIns. Idempotent: drops a
# prior BTTSShare target/group/embed phase first.
#
# Run AFTER `npx cap sync ios` and AFTER add_watch_target.rb / add_widget_target.rb
# (it only adds its own target + group + embed phase; no overlap with theirs).
# See docs/ios-shell-roadmap.md.
#
# No App Group / extra capability: the shared URL is passed inline in the
# btts://share?url=… deep link, so automatic signing just needs the bundle id —
# no portal capability assignment (unlike the widget's App Group).
require "xcodeproj"

ROOT = File.expand_path("../ios/App", __dir__)
PROJ = File.join(ROOT, "App.xcodeproj")
SHARE_BUNDLE_ID = "com.roitsch.btts.BTTSShare"

project = Xcodeproj::Project.open(PROJ)
app_target = project.targets.find { |t| t.name == "App" } or abort("App target not found")

# --- Clean slate: drop any prior BTTSShare target + group + embed phase -------
project.targets.select { |t| t.name == "BTTSShare" }.each do |t|
  app_target.dependencies.dup.each do |d|
    d.remove_from_project if d.target == t
  end
  t.remove_from_project
end
app_target.build_phases.select { |p|
  p.respond_to?(:name) && p.name == "Embed Share Extension"
}.each(&:remove_from_project)
if (g = project.main_group["BTTSShare"])
  g.remove_from_project
end

# --- Share file references -----------------------------------------------------
share_group = project.main_group.new_group("BTTSShare", "BTTSShare")
swift_refs = %w[ShareViewController.swift].map { |f| share_group.new_reference(f) }
share_group.new_reference("Info.plist") # referenced via INFOPLIST_FILE

# --- The share extension target -----------------------------------------------
share_target = project.new_target(:app_extension, "BTTSShare", :ios, "15.0", nil, :swift)
share_target.add_file_references(swift_refs)

settings = {
  "PRODUCT_BUNDLE_IDENTIFIER" => SHARE_BUNDLE_ID,
  "PRODUCT_NAME" => "$(TARGET_NAME)",
  "INFOPLIST_FILE" => "BTTSShare/Info.plist",
  "GENERATE_INFOPLIST_FILE" => "NO",
  "CODE_SIGN_STYLE" => "Automatic",
  "SWIFT_VERSION" => "5.0",
  "IPHONEOS_DEPLOYMENT_TARGET" => "15.0",
  "TARGETED_DEVICE_FAMILY" => "1",
  "SDKROOT" => "iphoneos",
  "SKIP_INSTALL" => "YES", # embedded-only — ships inside the app, not as a top-level product
  "MARKETING_VERSION" => "1.0",
  "CURRENT_PROJECT_VERSION" => "1", # the xcodebuild invocation overrides this build-wide
  "LD_RUNPATH_SEARCH_PATHS" => "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks",
}
share_target.build_configurations.each do |config|
  settings.each { |k, v| config.build_settings[k] = v }
end

# --- Embed the extension into the app's PlugIns + build dependency ------------
app_target.add_dependency(share_target)
embed = app_target.new_copy_files_build_phase("Embed Share Extension")
embed.symbol_dst_subfolder_spec = :plug_ins
bf = embed.add_file_reference(share_target.product_reference, true)
bf.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }

project.save
puts "OK: added BTTSShare target (#{share_target.uuid}) + embed phase."
