#pragma once
#include "protocol.h"
#include "config.h"
namespace pm {
#if CALIBRATION_PROFILE == 1
constexpr Polynomial currentProfile = {0.000520401296, -0.008096351376, 0.0384854598, 0.3661410109, 0.0435};
constexpr Polynomial voltageProfile = {0, 0, -0.18958, 80.35625, -8281.21667};
constexpr Polynomial powerProfile = {0, 0.000000005306441618, -0.00002260346534, 0.4755718712, 4.85};
#else
constexpr Polynomial currentProfile = {0.00003477587487, -0.002366661164, 0.02716394848, 0.3593063614, 0.056};
constexpr Polynomial voltageProfile = {0, 0, 0.25089, -103.05982, 10810.55179};
constexpr Polynomial powerProfile = {0, 0.00000008430588077, -0.0001216257504, 0.5131658192, 5.1};
#endif
}
