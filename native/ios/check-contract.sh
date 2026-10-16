#!/bin/sh
set -eu
cd "$(dirname "$0")"
output=$(mktemp -d "${TMPDIR:-/tmp}/worth-swift.XXXXXX")
trap 'rm -rf "$output"' EXIT HUP INT TERM
xcrun swiftc Shared/WidgetModels.swift Checks/main.swift -o "$output/check-contract"
"$output/check-contract"
# Parsing checks syntax only. It does not replace an iOS SDK build or device verification.
xcrun swiftc -frontend -parse Shared/WidgetStore.swift Shared/WidgetService.swift App/WorthApp.swift Widgets/WorthWidgets.swift
