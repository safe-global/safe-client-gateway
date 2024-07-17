DROP TABLE IF EXISTS notification_types,
    notification_subscriptions,
    notification_channels,
    notification_channel_configurations CASCADE;

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
-- Notification channels, e.g. PUSH_NOTIFICATIONS --
---------------------------------------------------
CREATE TABLE notification_channels(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Add PUSH_NOTIFICATIONS as a notification channel
INSERT INTO notification_channels (name) VALUES
    ('PUSH_NOTIFICATIONS');

----------------------------------------------------------------
-- Configuration for a given notification subscription/channel --
----------------------------------------------------------------
CREATE TABLE notification_channel_configurations(
    id SERIAL PRIMARY KEY,
    notification_subscription_id INT NOT NULL,
    notification_channel_id INT NOT NULL,
    cloud_messaging_token VARCHAR(255) NOT NULL,
    device_uuid UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (notification_subscription_id) REFERENCES notification_subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
);

-- Update updated_at when a notification channel is updated
CREATE OR REPLACE TRIGGER update_notification_channel_configurations_updated_at
    BEFORE UPDATE ON notification_channel_configurations
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();