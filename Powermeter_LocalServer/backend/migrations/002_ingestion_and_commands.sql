-- Separate PRD enhancements. Applying this file requires explicit operator approval.
ALTER TABLE public.measurements
    ADD COLUMN received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN message_id VARCHAR(128),
    ADD CONSTRAINT measurements_device_message_unique UNIQUE (device_id, message_id);

CREATE TABLE public.relay_commands (
    command_id UUID PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES public.devices(id),
    relay_number SMALLINT NOT NULL CHECK (relay_number = 1),
    state BOOLEAN NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'published', 'confirmed', 'timed_out', 'failed')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    error TEXT
);
CREATE INDEX idx_relay_commands_device_time ON public.relay_commands (device_id, requested_at DESC, command_id DESC);
CREATE INDEX idx_relay_commands_pending ON public.relay_commands (requested_at)
    WHERE status IN ('requested', 'published');
