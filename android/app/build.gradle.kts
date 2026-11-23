plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release signing comes from env vars (set from GitHub secrets in CI, or locally).
// Never commit the keystore.
val ksFile = System.getenv("MASON_TV_KEYSTORE_FILE")
val ksPass = System.getenv("MASON_TV_KEYSTORE_PASSWORD")

android {
    namespace = "com.mason.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.mason.tv"
        minSdk = 26
        targetSdk = 35
        // Bump on every release build.
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "BASE_URL", "\"https://streams-c.vercel.app\"")
    }

    signingConfigs {
        if (ksFile != null && ksPass != null) {
            create("release") {
                storeFile = file(ksFile)
                storePassword = ksPass
                keyAlias = "masontv"
                keyPassword = ksPass
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
        }
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
