-- New COE tickets begin as active learning work unless an explicit status is supplied.
ALTER TABLE "coe_tickets" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';
