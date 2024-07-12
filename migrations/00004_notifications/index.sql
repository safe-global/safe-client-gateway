DROP TABLE IF EXISTS notification_types,
    notification_subscriptions,
    notification_mediums,
    notification_medium_configurations CASCADE;

--------------------------------------------
-- Notification types, e.g.INCOMING_TOKEN --
--------------------------------------------
CREATE TABLE notification_types(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- TODO: Confirm these types
INSERT INTO notification_types (name) VALUES
    ('DELETED_MULTISIG_TRANSACTION'),
    ('EXECUTED_MULTISIG_TRANSACTION'),
    ('INCOMING_ETHER'),
    ('INCOMING_TOKEN'),
    ('MESSAGE_CREATED'),
    ('MODULE_TRANSACTION'),
    ('NEW_CONFIRMATION'),
    ('MESSAGE_CONFIRMATION'),
    ('OUTGOING_ETHER'),
    ('OUTGOING_TOKEN'),
    ('PENDING_MULTISIG_TRANSACTION'),
    ('SAFE_CREATED');

----------------------------------------------------------------------
-- Chain-specific Safe notification preferences for a given account --
----------------------------------------------------------------------
CREATE TABLE notification_subscriptions(
    id SERIAL PRIMARY KEY,
    account_id INT NOT NULL,
    notification_type_id INT NOT NULL,
    chain_id INT NOT NULL,
    safe_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_type_id) REFERENCES notification_types(id) ON DELETE CASCADE,
    UNIQUE(account_id, chain_id, safe_address, notification_type_id)
);

-- Update updated_at when a notification subscription is updated
CREATE OR REPLACE TRIGGER update_notification_subscriptions_updated_at
    BEFORE UPDATE ON notification_subscriptions
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

---------------------------------------------------
-- Notification mediums, e.g. PUSH_NOTIFICATIONS --
---------------------------------------------------
CREATE TABLE notification_mediums(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Add PUSH_NOTIFICATIONS as a notification medium
INSERT INTO notification_mediums (name) VALUES
    ('PUSH_NOTIFICATIONS');

----------------------------------------------------------------
-- Configuration for a given notification subscription/medium --
----------------------------------------------------------------
CREATE TABLE notification_medium_configurations(
    id SERIAL PRIMARY KEY,
    notification_subscription_id INT NOT NULL,
    notification_medium_id INT NOT NULL,
    cloud_messaging_token VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (notification_subscription_id) REFERENCES notification_subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_medium_id) REFERENCES notification_mediums(id) ON DELETE CASCADE
);

-- Update updated_at when a notification medium is updated
CREATE OR REPLACE TRIGGER update_notification_medium_configurations_updated_at
    BEFORE UPDATE ON notification_medium_configurations
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Require cloud_messaging_token to be set with PUSH_NOTIFICATIONS
CREATE OR REPLACE FUNCTION require_cloud_messaging_token_for_push_notifications()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.id = (SELECT id FROM notification_mediums WHERE name = 'PUSH_NOTIFICATIONS') AND NEW.cloud_messaging_token IS NULL) THEN
        RAISE EXCEPTION 'cloud_messaging_token is required for PUSH_NOTIFICATIONS of notification_mediums';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_require_cloud_messaging_token_for_push_notifications
BEFORE INSERT OR UPDATE ON notification_medium_configurations
FOR EACH ROW
EXECUTE FUNCTION require_cloud_messaging_token_for_push_notifications();

-- Only allow cloud_messaging_token to be set for notification_mediums.name PUSH_NOTIFICATIONS
CREATE OR REPLACE FUNCTION check_cloud_messaging_token_medium()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.cloud_messaging_token IS NOT NULL AND NEW.notification_medium_id != (SELECT id FROM notification_mediums WHERE name = 'PUSH_NOTIFICATIONS')) THEN
        RAISE EXCEPTION 'cloud_messaging_token can only be set for PUSH_NOTIFICATIONS of notification_mediums';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_cloud_messaging_token_medium
BEFORE INSERT OR UPDATE ON notification_medium_configurations
FOR EACH ROW
EXECUTE FUNCTION check_cloud_messaging_token_medium();