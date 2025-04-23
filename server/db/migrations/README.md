# Database Migrations

This directory contains migration scripts for the AI Quiz Game database.

## Migration 001: Add Transaction Functions and Columns

This migration adds:

1. Transaction support functions for the database
2. `last_activity_at` column to the games table
3. `socket_host_id` column to the games table
4. `time_limit` column to the quizzes table if it doesn't exist

These changes are necessary for:
- Persisting game state between server restarts
- Maintaining socket connections
- Supporting timed quizzes

### How to Apply This Migration

Run the following command in the Supabase SQL Editor or connect directly to your PostgreSQL database:

```sql
-- Load and execute the migration file
\i '/path/to/001_add_transaction_functions.sql'
```

Or copy and paste the contents of the file into the SQL Editor.

## Migration 002: Update Player and Game Schema

This migration updates the schema to better handle socket IDs and user IDs:

1. Makes `host_id` column in games table optional (NULL allowed)
2. Adds `user_id` column to the players table to link players to user accounts
3. Adds `host_disconnected_at` column to track when hosts disconnect (for reconnection)
4. Adds indexes to `socket_id`, `user_id`, and `socket_host_id` columns for faster lookups

These changes are necessary for:
- Properly storing socket IDs (which are not valid UUIDs)
- Maintaining relationships between socket connections and user accounts
- Improving query performance with high-volume game sessions

### How to Apply This Migration

Run the following command in the Supabase SQL Editor or connect directly to your PostgreSQL database:

```sql
-- Load and execute the migration file
\i '/path/to/002_update_player_and_game_schema.sql'
```

Or copy and paste the contents of the file into the SQL Editor.