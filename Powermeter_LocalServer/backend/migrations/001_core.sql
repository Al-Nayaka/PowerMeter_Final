CREATE TABLE public.devices (
    id BIGSERIAL PRIMARY KEY,
    device_code VARCHAR(64) NOT NULL UNIQUE CHECK (device_code ~ '^[A-Za-z0-9_-]+$'),
    device_name VARCHAR(120) NOT NULL,
    location VARCHAR(200),
    mqtt_topic_prefix VARCHAR(160) NOT NULL UNIQUE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT devices_canonical_topic CHECK (mqtt_topic_prefix = 'powermeter/' || device_code)
);

CREATE TABLE public.measurements (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES public.devices(id),
    voltage NUMERIC(10,2) NOT NULL CHECK (voltage >= 0 AND voltage < 'Infinity'::numeric),
    current NUMERIC(12,3) NOT NULL CHECK (current >= 0 AND current < 'Infinity'::numeric),
    active_power NUMERIC(14,2) NOT NULL CHECK (active_power >= 0 AND active_power < 'Infinity'::numeric),
    energy_wh NUMERIC(18,3) NOT NULL CHECK (energy_wh >= 0 AND energy_wh < 'Infinity'::numeric),
    power_factor NUMERIC(5,4) CHECK (power_factor BETWEEN 0 AND 1),
    recorded_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_measurements_device_time ON public.measurements (device_id, recorded_at DESC, id DESC);

CREATE TABLE public.relay_states (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES public.devices(id),
    relay_number SMALLINT NOT NULL CHECK (relay_number = 1),
    state BOOLEAN NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_relay_states_device_time ON public.relay_states (device_id, relay_number, changed_at DESC, id DESC);
CREATE INDEX idx_relay_states_latest_order ON public.relay_states (device_id, relay_number, id DESC);

CREATE TABLE public.system_events (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT REFERENCES public.devices(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_system_events_device_time ON public.system_events (device_id, created_at DESC, id DESC);
