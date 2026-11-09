#pragma once
#if __has_include("config.local.h")
#include "config.local.h"
#else
#include "config.example.h"
#endif
static_assert(CALIBRATION_PROFILE == 1 || CALIBRATION_PROFILE == 3, "Choose profile 1 or 3");
static_assert(RELAY_ON_LEVEL == 0 || RELAY_ON_LEVEL == 1, "Relay level must be 0/1");
static_assert(RELAY_GPIO >= 0 && RELAY_GPIO <= 33 &&
              !(RELAY_GPIO >= 6 && RELAY_GPIO <= 11) &&
              RELAY_GPIO != 13 && RELAY_GPIO != 26 && RELAY_GPIO != 32 &&
              RELAY_GPIO != 1 && RELAY_GPIO != 3,
              "Relay GPIO must support output and not collide with flash, meter or serial");
