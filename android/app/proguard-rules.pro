# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Google Play Services (Auth, Drive)
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Google API Client (HTTP + Auth)
-keep class com.google.api.client.** { *; }
-dontwarn com.google.api.client.**

# Google OAuth libs
-keep class com.google.api.client.googleapis.** { *; }
-dontwarn com.google.api.client.googleapis.**

# Google Drive API service
-keep class com.google.api.services.drive.** { *; }
-dontwarn com.google.api.services.drive.**

# Google HTTP transport
-keep class com.google.api.client.http.** { *; }
-dontwarn com.google.api.client.http.**

# JSON / Jackson used by Drive API
-keep class com.google.api.client.json.** { *; }
-dontwarn com.google.api.client.json.**

# Apache HTTP legacy (Drive API használja)
-dontwarn org.apache.http.**
-keep class org.apache.http.** { *; }

# React Native Google Sign-In plugin
-keep class com.reactnativegooglesignin.** { *; }
-dontwarn com.reactnativegooglesignin.**

# Prevent minification of ActivityResult handling
-keep class com.google.android.gms.common.api.GoogleApiActivity { *; }

# Google Sign-In
-keep class com.google.android.gms.** { *; }
-keep class com.google.firebase.** { *; }
-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.**

# React Native Google Sign-In
-keep class com.reactnativegooglesignin.** { *; }
-dontwarn com.reactnativegooglesignin.**