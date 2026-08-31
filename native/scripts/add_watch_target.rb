#!/usr/bin/env ruby
# WAS: add the BTTSWatch watchOS app target. The Apple Watch step-haptics were
# RETIRED on 2026-08-29 — background haptics never worked (buzzes died after the
# 2nd pour once the wrist dropped) and the last attempt drained the watch battery
# in a few hours. So this script now REMOVES any BTTSWatch target from the
# cap-synced project and only wires the app-local plugins (ScreenAwake +
# MainViewController) that used to ride alongside it. It keeps this filename
# because .github/workflows/ios-testflight.yml and native/scripts/mac-build-upload.sh
# call it by name (and add_widget_target.rb documents that MainViewController is
# wired here). Idempotent: safe to re-run after every `cap sync`.
require "xcodeproj"

ROOT = File.expand_path("../ios/App", __dir__)
PROJ = File.join(ROOT, "App.xcodeproj")

project = Xcodeproj::Project.open(PROJ)
app_target = project.targets.find { |t| t.name == "App" } or abort("App target not found")

# --- Drop any prior BTTSWatch target + group + embed phase (removes the watch) -
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

# --- Wire the app-local plugins into the App target ---------------------------
# MainViewController.swift registers WidgetBridge / LiveActivity / ScreenAwake in
# capacitorDidLoad (an app-local plugin is NOT auto-discovered by Capacitor — only
# npm plugins land in packageClassList — so without these refs the classes don't
# compile). BrewWatchPlugin.swift is gone; sweep any stale ref to it too so the
# pbxproj never dangles at a deleted file.
STALE = %w[BrewWatchPlugin.swift ScreenAwakePlugin.swift MainViewController.swift]
KEEP  = %w[ScreenAwakePlugin.swift MainViewController.swift]
app_group = project.main_group["App"] or abort("App group not found")
STALE.each do |name|
  while (old = app_group.files.find { |f| f.display_name == name })
    old.remove_from_project
  end
end
app_target.add_file_references(KEEP.map { |name| app_group.new_reference(name) })

project.save
puts "OK: removed any BTTSWatch target + wired app plugins (#{KEEP.join(', ')})."
