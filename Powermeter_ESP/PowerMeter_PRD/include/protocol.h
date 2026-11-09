#pragma once
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>

namespace pm {
inline bool safeToken(const char* s, size_t max) {
  if (!s || !*s || strlen(s) > max) return false;
  for (; *s; ++s) {
    if (!((*s >= 'A' && *s <= 'Z') || (*s >= 'a' && *s <= 'z') ||
          (*s >= '0' && *s <= '9') || *s == '-' || *s == '_')) return false;
  }
  return true;
}
inline bool parseUtc(const char* s, int64_t& epoch) {
  if (!s) return false;
  const size_t n = strlen(s);
  if (n != 20 && n != 24) return false;
  for (size_t i = 0; i < n; ++i) {
    if (i == 4 || i == 7) { if (s[i] != '-') return false; }
    else if (i == 10) { if (s[i] != 'T') return false; }
    else if (i == 13 || i == 16) { if (s[i] != ':') return false; }
    else if (i == n - 1) { if (s[i] != 'Z') return false; }
    else if (i == 19 && n == 24) { if (s[i] != '.') return false; }
    else if (s[i] < '0' || s[i] > '9') return false;
  }
  int y, m, d, h, min, sec;
  if (sscanf(s, "%4d-%2d-%2dT%2d:%2d:%2d", &y, &m, &d, &h, &min, &sec) != 6)
    return false;
  if (y < 2024 || y > 2099 || m < 1 || m > 12 || h > 23 || min > 59 || sec > 59)
    return false;
  const bool leap = y % 4 == 0 && (y % 100 != 0 || y % 400 == 0);
  const int days[] = {31,28,31,30,31,30,31,31,30,31,30,31};
  if (d < 1 || d > days[m-1] + (m == 2 && leap ? 1 : 0)) return false;
  int64_t total = 0;
  for (int year = 1970; year < y; ++year)
    total += 365 + (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0));
  for (int month = 1; month < m; ++month)
    total += days[month-1] + (month == 2 && leap ? 1 : 0);
  epoch = ((total + d - 1) * 24 + h) * 3600 + min * 60 + sec;
  return true;
}
inline bool fresh(int64_t issued, int64_t now) {
  return now > 0 && issued >= now - 30 && issued <= now + 5;
}
struct Polynomial { double a, b, c, d, e; };
inline double integrateEnergy(double total, double previousPower, double power, uint32_t elapsed) {
  if (!std::isfinite(previousPower) || !std::isfinite(power) ||
      previousPower < 0 || power < 0 || elapsed > 5000) return total;
  return total + (previousPower + power) * 0.5 * elapsed / 3600000.0;
}
inline double calibrated(double raw, Polynomial p, double maximum) {
  if (!std::isfinite(raw) || raw < 0) return NAN;
  if (raw == 0) return 0; // Polynomial offsets must not invent a no-load reading.
  double value = ((((p.a * raw) + p.b) * raw + p.c) * raw + p.d) * raw + p.e;
  if (!std::isfinite(value) || value > maximum) return NAN;
  return value < 0 ? 0 : value;
}
struct CommandRecord { char id[65] = {}; bool state = false; char confirmed[25] = {}; };
class CommandCache {
  CommandRecord records[16];
  unsigned next = 0;
 public:
  const CommandRecord* find(const char* id) const {
    for (const auto& r : records) if (*r.id && strcmp(r.id, id) == 0) return &r;
    return nullptr;
  }
  const CommandRecord& remember(const char* id, bool state, const char* confirmed) {
    auto& r = records[next];
    snprintf(r.id, sizeof(r.id), "%s", id);
    r.state = state;
    snprintf(r.confirmed, sizeof(r.confirmed), "%s", confirmed);
    next = (next + 1) % 16;
    return r;
  }
};
}
