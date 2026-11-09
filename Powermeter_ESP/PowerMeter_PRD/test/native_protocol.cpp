#include "protocol.h"
#include <cassert>
#include <cmath>
#include <cstdio>

int main() {
  int64_t epoch = 0;
  assert(pm::parseUtc("2026-11-09T10:00:00.000Z", epoch));
  assert(epoch == 1794218400);
  assert(pm::parseUtc("2024-02-29T23:59:59Z", epoch));
  assert(!pm::parseUtc("2026-02-29T00:00:00Z", epoch));
  assert(!pm::parseUtc("2026-11-09T10:00:00+07:00", epoch));
  assert(!pm::parseUtc("2026-11-09T10:00:00.000Zjunk", epoch));
  assert(pm::fresh(100, 130));
  assert(!pm::fresh(100, 131));
  assert(pm::fresh(105, 100));
  assert(!pm::fresh(106, 100));
  assert(!pm::fresh(100, 0));
  assert(pm::safeToken("cmd-123_abc", 64));
  assert(!pm::safeToken("bad/topic", 64));
  pm::CommandCache cache;
  cache.remember("a", true, "2026-11-09T10:00:00Z");
  assert(cache.find("a") && cache.find("a")->state);
  assert(!cache.find("b"));
  assert(pm::calibrated(0, {0, 0, 0, 1, 5}, 100) == 0);
  assert(pm::calibrated(10, {0, 0, 0, 1, -20}, 100) == 0);
  assert(std::isnan(pm::calibrated(200, {0, 0, 0, 1, 0}, 100)));
  assert(pm::integrateEnergy(0, 3600, 3600, 1000) == 1);
  assert(pm::integrateEnergy(10, NAN, 3600, 1000) == 10);
  assert(pm::integrateEnergy(10, 3600, 3600, 6000) == 10);
  assert(pm::integrateEnergy(10, 0, 0, 1000) == 10);
  puts("native protocol checks passed");
}
