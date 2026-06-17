#!/usr/bin/env ruby
# Adds the BTTSWidget WidgetKit app-extension target to the Capacitor-generated
# Xcode project, plus the phone-side WidgetBridge.swift, the App Group
# entitlement on BOTH the App and the widget, an Embed App Extensions phase, and
# the target dependency. Idempotent: re-running removes a prior BTTSWidget target
# first so the project never accumulates duplicates.
#
# Run AFTER `npx cap sync ios` and AFTER add_watch_target.rb (both touch the App
# target; this only adds WidgetBridge.swift + the App-group entitlement wiring,
# so it doesn't collide with the watch script). See docs/ios-shell-roadmap.md (G2).
#
# Prereq baked OUTSIDE this script (Apple side, once): App Groups capability
# enabled on App IDs com.roitsch.btts + com.roitsch.btts.BTTSWidget, and the
# group `group.com.roitsch.btts` registered — else automatic signing can't bake
# the application-groups entitlement. See the roadmap G2 checklist.
require "xcodeproj"

ROOT = File.expand_path("../ios/App", __dir__)
PROJ = File.join(ROOT, "App.xcodeproj")
WIDGET_BUNDLE_ID = "com.roitsch.btts.BTTSWidget"

project = Xcodeproj::Project.open(PROJ)
app_target = project.targets.find { |t| t.name == "App" } or abort("App target not found")

# --- Clean slate: drop any prior BTTSWidget target + group + embed phase ------
project.targets.select { |t| t.name == "BTTSWidget" }.each do |t|
  app_target.dependencies.dup.each do |d|
    d.remove_from_project if d.target == t
  end
  t.remove_from_project
end
app_target.build_phases.select { |p|
  p.respond_to?(:name) && p.name == "Embed Foundation Extensions"
}.each(&:remove_from_project)
if (g = project.main_group["BTTSWidget"])
  g.remove_from_project
end
# Drop prior refs to our App-target files so we don't double-add them.
app_group = project.main_group["App"] or abort("App group not found")
%w[WidgetBridge.swift LiveActivityPlugin.swift BrewActivityAttributes.swift].each do |name|
  if (old = app_group.files.find { |f| f.display_name == name })
    old.remove_from_project
  end
end

# --- Widget file references ----------------------------------------------------
widget_group = project.main_group.new_group("BTTSWidget", "BTTSWidget")
swift_refs = %w[BTTSWidget.swift BrewLiveActivity.swift].map { |f| widget_group.new_reference(f) }
widget_group.new_reference("Info.plist") # referenced via INFOPLIST_FILE, not a build phase
widget_group.new_reference("BTTSWidget.entitlements") # referenced via CODE_SIGN_ENTITLEMENTS

# Shared ActivityAttributes — ONE file compiled into BOTH the widget and the App
# target (the Live Activity type the app starts/updates and the widget renders).
# Lives in App/, referenced from the App group; added to both targets below.
attrs_ref = app_group.new_reference("BrewActivityAttributes.swift")

# --- The widget extension target ----------------------------------------------
widget_target = project.new_target(:app_extension, "BTTSWidget", :ios, "17.0", nil, :swift)
widget_target.add_file_references(swift_refs + [attrs_ref])

wsettings = {
  "PRODUCT_BUNDLE_IDENTIFIER" => WIDGET_BUNDLE_ID,
  "PRODUCT_NAME" => "$(TARGET_NAME)",
  "INFOPLIST_FILE" => "BTTSWidget/Info.plist",
  "CODE_SIGN_ENTITLEMENTS" => "BTTSWidget/BTTSWidget.entitlements", # App Group
  "GENERATE_INFOPLIST_FILE" => "NO",
  "CODE_SIGN_STYLE" => "Automatic",
  "SWIFT_VERSION" => "5.0",
  "IPHONEOS_DEPLOYMENT_TARGET" => "17.0",
  "TARGETED_DEVICE_FAMILY" => "1",
  "SDKROOT" => "iphoneos",
  "SKIP_INSTALL" => "YES", # embedded-only: the extension ships inside the app, not as a top-level product
  "MARKETING_VERSION" => "1.0",
  "CURRENT_PROJECT_VERSION" => "1", # the xcodebuild invocation overrides this for the whole build
  "LD_RUNPATH_SEARCH_PATHS" => "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks",
}
widget_target.build_configurations.each do |config|
  wsettings.each { |k, v| config.build_settings[k] = v }
end

# --- App Group entitlement on the App target (first app-level capability) ------
# The App target had no entitlements file before the widget; point it at the new
# App.entitlements every run so cap sync can't drop it.
app_target.build_configurations.each do |config|
  config.build_settings["CODE_SIGN_ENTITLEMENTS"] = "App/App.entitlements"
end

# --- Phone-side WidgetBridge.swift into the App target ------------------------
# MainViewController.capacitorDidLoad registers WidgetBridgePlugin (added by
# add_watch_target.rb's APP_SWIFT_FILES); the class must compile, so the source
# must be in the App target. (App.entitlements is referenced via the build
# setting, not as a compiled source, so it is NOT added here.)
app_target.add_file_references([
  app_group.new_reference("WidgetBridge.swift"),
  app_group.new_reference("LiveActivityPlugin.swift"),
  attrs_ref,
])

# --- Embed the widget into the app's PlugIns + build dependency ---------------
app_target.add_dependency(widget_target)
embed = app_target.new_copy_files_build_phase("Embed Foundation Extensions")
embed.symbol_dst_subfolder_spec = :plug_ins
bf = embed.add_file_reference(widget_target.product_reference, true)
bf.settings = { "ATTRIBUTES" => ["RemoveHeadersOnCopy"] }

project.save
puts "OK: added BTTSWidget target (#{widget_target.uuid}) + embed phase + WidgetBridge ref + App Group entitlements."
