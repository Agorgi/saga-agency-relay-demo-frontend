-- Add DEMO_COMPOSITE to PersonSource enum so seeded CreatorProfile rows
-- can be clearly distinguished from real talent. Surface uses this to
-- render a "Composite" badge on candidate cards. Outreach can never
-- fire to these rows: the Twilio kill switch is on and they carry no
-- phone/email values.
ALTER TYPE "PersonSource" ADD VALUE 'DEMO_COMPOSITE';
