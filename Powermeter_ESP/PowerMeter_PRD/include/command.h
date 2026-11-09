#pragma once
#include <ArduinoJson.h>
#include "protocol.h"
namespace pm {
struct Command { char id[65]; bool state; int64_t expires; };
struct CommandReader {
  const char* input;
  size_t length, position = 0;
  CommandReader(const char* data, size_t size) : input(data), length(size) {}
  int read() { return position < length ? static_cast<unsigned char>(input[position++]) : -1; }
  size_t readBytes(char* buffer, size_t count) {
    size_t size = count < length - position ? count : length - position;
    memcpy(buffer, input + position, size);
    position += size;
    return size;
  }
};
inline bool decodeCommand(const char* payload, size_t length, const char* device,
                          int64_t now, Command& command) {
  if (!payload || length == 0 || length > 512 || memchr(payload, '\0', length)) return false;
  StaticJsonDocument<768> doc;
  CommandReader reader(payload, length);
  if (deserializeJson(doc, reader, DeserializationOption::NestingLimit(2)) ||
      !doc.is<JsonObject>() || doc.size() != 6 ||
      !doc["command_id"].is<const char*>() || !doc["device_code"].is<const char*>() ||
      !doc["relay_number"].is<int>() || doc["relay_number"].as<int>() != 1 ||
      !doc["state"].is<bool>() || !doc["issued_at"].is<const char*>() ||
      !doc["expires_at"].is<const char*>()) return false;
  for (size_t i = reader.position; i < length; ++i)
    if (payload[i] != ' ' && payload[i] != '\r' && payload[i] != '\n' && payload[i] != '\t') return false;
  for (const char* key : {"command_id", "device_code", "issued_at", "expires_at"}) {
    JsonString text = doc[key].as<JsonString>();
    if (text.size() != strlen(text.c_str())) return false;
  }
  const char* id = doc["command_id"];
  const char* code = doc["device_code"];
  int64_t issued, expires;
  if (!safeToken(id, 64) || !safeToken(code, 48) || strcmp(code, device) ||
      !parseUtc(doc["issued_at"], issued) || !fresh(issued, now) ||
      !parseUtc(doc["expires_at"], expires) || expires <= issued ||
      expires - issued > 60 || now >= expires) return false;
  snprintf(command.id, sizeof(command.id), "%s", id);
  command.state = doc["state"].as<bool>();
  command.expires = expires;
  return true;
}
}
