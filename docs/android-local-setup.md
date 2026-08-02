# Android Local Setup

The React Native Android project is integrated under:

```text
apps/mobile/android
```

## Required Local Tools

- JDK 17
- Android Studio
- Android SDK Platform 34
- Android SDK Build Tools 34
- Android emulator or USB debugging-enabled Android device

## Environment Variables

Windows examples:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\openjdk\jdk-21.0.8"
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
```

Persist these through Windows Environment Variables after confirming the paths on your machine.

## Build Commands

From the repository root:

```bash
corepack pnpm install
corepack pnpm --filter @family-monitor/mobile android
```

Or build directly:

```bash
cd apps/mobile/android
./gradlew :app:assembleDebug
```

## Current Machine Note

This machine now has Android CLI installed through winget and Android SDK packages installed at:

```text
C:\Users\mahil\AppData\Local\Android\Sdk
```

Installed SDK packages:

- Android SDK Platform 34
- Android SDK Build Tools 34.0.0
- Android SDK Platform-Tools
- Android Emulator

The current usable Java path is:

```text
C:\Program Files\Android\openjdk\jdk-21.0.8
```

`apps/mobile/android/local.properties` pins the SDK path for Gradle.

The Gradle 8.8 ZIP was downloaded manually to:

```text
C:\Users\mahil\Downloads\gradle-8.8-bin.zip
```

It was extracted for local use under:

```text
C:\Users\mahil\Downloads\project-docs\.tools\gradle-8.8
```

Android Gradle debug build now succeeds. The generated debug APK is:

```text
C:\Users\mahil\Downloads\project-docs\apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

To rebuild it, run:

```powershell
cd apps/mobile/android
$env:JAVA_HOME="C:\Program Files\Android\openjdk\jdk-21.0.8"
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
..\..\..\.tools\gradle-8.8\bin\gradle.bat :app:assembleDebug
```
