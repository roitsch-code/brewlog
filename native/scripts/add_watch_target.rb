#!/usr/bin/env ruby
# Adds the BTTSWatch watchOS app target to the Capacitor-generated Xcode
# project, plus the phone-side BrewWatchPlugin.swift, an Embed Watch Content
# phase, and the target dependency. Idempotent: re-running removes a prior
# BTTSWatch target first so the project never accumulates duplicates.
#
# Why a script (not the Xcode GUI): the build is driven headless on this Mac /
# CI, and the watch target must be reproducible from source. See
# docs/ios-shell-roadmap.md (G4).
require "xcodeproj"

ROOT = File.expand_path("../ios/App", __dir__)
PROJ = File.join(ROOT, "App.xcodeproj")
WATCH_BUNDLE_ID = "com.roitsch.btts.watchkitapp"
COMPANION_BUNDLE_ID = "com.roitsch.btts"

project = Xcodeproj::Project.open(PROJ)
app_target = project.targets.find { |t| t.name == "App" } or abort("App target not found")

# --- Clean slate: drop any prior BTTSWatch target + group + embed phase -------
project.targets.select { |t| t.name == "BTTSWatch" }.each do |t|
  app_target.dependencies.dup.each do |d|
    d.remove_from_project if d.target == t
  end
  t.remove_from_project
end
app_target.build_phases.select { |p|
  p.respond_to?(:name) && p.name == "Embed Watch Content"
}.each(&:remove_from_project)
if (g = project.main_group["BTTSWatch"])
  g.remove_from_project
end
# Drop a prior BrewWatchPlugin.swift ref so we don't double-add it.
app_group = project.main_group["App"] or abort("App group not found")
if (old = app_group.files.find { |f| f.display_name == "BrewWatchPlugin.swift" })
  old.remove_from_project
end

# --- Watch file references ----------------------------------------------------
watch_group = project.main_group.new_group("BTTSWatch", "BTTSWatch")
swift_refs = %w[BTTSWatchApp.swift BrewWatchModel.swift ContentView.swift].map { |f| watch_group.new_reference(f) }
assets_ref = watch_group.new_reference("Assets.xcassets")
watch_group.new_reference("Info.plist") # referenced via INFOPLIST_FILE, not a build phase

# --- The watch app target -----------------------------------------------------
watch_target = project.new_target(:application, "BTTSWatch", :watchos, "9.0", nil, :swift)
watch_target.add_file_references(swift_refs + [assets_ref])

settings = {
  "PRODUCT_BUNDLE_IDENTIFIER" => WATCH_BUNDLE_ID,
  "PRODUCT_NAME" => "$(TARGET_NAME)",
  "INFOPLIST_FILE" => "BTTSWatch/Info.plist",
  "GENERATE_INFOPLIST_FILE" => "NO",
  "CODE_SIGN_STYLE" => "Automatic",
  "SWIFT_VERSION" => "5.0",
  "WATCHOS_DEPLOYMENT_TARGET" => "9.0",
  "TARGETED_DEVICE_FAMILY" => "4",
  "SDKROOT" => "watchos",
  "ASSETCATALOG_COMPILER_APPICON_NAME" => "AppIcon",
  "SKIP_INSTALL" => "NO",
  "MARKETING_VERSION" => "1.0",
  "CURRENT_PROJECT_VERSION" => "1",
}
watch_target.build_configurations.each do |config|
  settings.each { |k, v| config.build_settings[k] = v }
end

# --- Phone-side plugin into the App target ------------------------------------
plugin_ref = app_group.new_reference("BrewWatchPlugin.swift")
app_target.add_file_references([plugin_ref])

# --- Embed the watch app into the iOS app + build dependency ------------------
app_target.add_dependency(watch_target)
embed = app_target.new_copy_files_build_phase("Embed Watch Content")
embed.symbol_dst_subfolder_spec = :products_directory
embed.dst_path = "$(CONTENTS_FOLDER_PATH)/Watch"
bf = embed.add_file_reference(watch_target.product_reference, true)
bf.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }

project.save
puts "OK: added BTTSWatch target (#{watch_target.uuid}) + embed phase + plugin ref."
