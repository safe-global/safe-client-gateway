ALTER TABLE outreaches 
    ADD COLUMN source_id INT NOT NULL,
    ADD COLUMN type VARCHAR(255) NOT NULL,
    ADD COLUMN team_name VARCHAR(255) NOT NULL,
    ADD CONSTRAINT unique_outreach_source_id UNIQUE (source_id);
