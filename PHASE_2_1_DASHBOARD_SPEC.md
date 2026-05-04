# Phase 2.1: Hero Dashboard

## Build Files Needed
1. app/dashboard/page.tsx
2. app/dashboard/dispute/[id]/page.tsx
3. lib/hooks/useDashboardData.ts

## Supabase Schema (Run in SQL Editor)
CREATE TABLE user_credits (id UUID PRIMARY KEY REFERENCES auth.users(id), current_score INT DEFAULT 600, initial_score INT, removed_count INT DEFAULT 0, tier VARCHAR(50), updated_at TIMESTAMP);
CREATE TABLE disputes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id), creditor_name VARCHAR(255), account_number VARCHAR(100), dispute_type VARCHAR(50), letter_sent_date TIMESTAMP, status VARCHAR(50) DEFAULT 'draft', response_received_date TIMESTAMP, removed_date TIMESTAMP, notes TEXT, created_at TIMESTAMP);
CREATE TABLE responses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), dispute_id UUID REFERENCES disputes(id), received_date TIMESTAMP, content TEXT, bureau_name VARCHAR(255), created_at TIMESTAMP);
CREATE TABLE recommendations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id), type VARCHAR(50), title VARCHAR(255), description TEXT, priority INT, dismissed BOOLEAN, created_at TIMESTAMP);

## Dashboard Sections
- Top: Score + removals + wins counters
- Middle: Active disputes table + recommended letters + recent responses
- Bottom: Recommendations (SOL expiring, age-offs, next steps)

## DIY vs Managed
DIY: Send letter buttons active, email reminders shown
Managed: Buttons disabled, activity log of what we did

## Git Commit
git commit -m "Phase 2.1: Hero dashboard with Supabase data"
git push origin main
