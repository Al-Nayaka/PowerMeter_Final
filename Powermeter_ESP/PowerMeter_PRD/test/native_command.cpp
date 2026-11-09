#include "command.h"
#include <cassert>
#include <cstdio>
#include <cstring>
#include <string>

int main() {
  const char* valid = "{\"command_id\":\"cmd-1\",\"device_code\":\"PM-ESP32-001\",\"relay_number\":1,\"state\":true,\"issued_at\":\"2026-11-09T10:00:00.000Z\",\"expires_at\":\"2026-11-09T10:00:10.000Z\"}";
  pm::Command c;
  auto decode = [&](const std::string& s, int64_t now = 1794218400) {
    return pm::decodeCommand(s.data(), s.size(), "PM-ESP32-001", now, c);
  };
  assert(decode(valid));
  assert(c.state && strcmp(c.id, "cmd-1") == 0);
  assert(!decode(valid, 1794218431));
  assert(!decode(valid, 1794218410));
  assert(decode(valid, 1794218409));
  assert(!decode("{\"command_id\":\"cmd-1\",\"device_code\":\"PM-ESP32-001\",\"relay_number\":1,\"state\":true,\"issued_at\":\"2026-11-09T10:00:00.000Z\"}"));
  assert(!decode(valid, 1794218394));
  assert(!decode(""));
  assert(!decode("{}"));
  assert(!decode("[1]"));
  assert(!decode(std::string(513, 'x')));
  std::string input = valid;
  input.replace(input.find("001"), 3, "003");
  assert(!decode(input));
  input = valid;
  input.replace(input.find("10:00:10"), 8, "10:00:00");
  assert(!decode(input));
  input = valid;
  input.replace(input.find("10:00:10"), 8, "10:01:01");
  assert(!decode(input));
  input = valid;
  input.replace(input.find("true"), 4, "\"ON\"");
  assert(!decode(input));
  input = valid;
  input.replace(input.find(":1,"), 4, ":2,");
  assert(!decode(input));
  input = valid;
  input.insert(1, "\"extra\":1,");
  assert(!decode(input));
  input = valid;
  input.insert(5, 1, '\0');
  assert(!decode(input));
  assert(!decode(std::string(valid) + "garbage"));
  assert(!decode(std::string(valid) + "{}"));
  input = valid;
  input.replace(input.find("cmd-1"), 5, "cmd-1\\u0000hidden");
  assert(!decode(input));
  assert(decode(std::string(valid) + " \r\n\t"));
  puts("native command checks passed");
}
