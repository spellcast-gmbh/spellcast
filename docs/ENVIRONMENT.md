# Environment Configuration

## Required Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Linear API Key - Get this from Linear Settings > API
LINEAR_API_KEY=your_linear_api_key_here

# Spellcast API Key for protecting endpoints
API_KEY=your_secure_api_key_here

# Default Project ID (Optional) - Linear project UUID to use when no project is specified
# You can use either the project UUID or the project name
DEFAULT_PROJECT_ID=your_default_project_id_or_name_here
```

## Example Configuration

```bash
# Using UUID
DEFAULT_PROJECT_ID=12345678-1234-1234-1234-123456789abc

# Using project name (recommended for readability)
DEFAULT_PROJECT_ID=Spellcast Backend
```

## Features

- **Name-to-ID Translation**: The API automatically translates human-readable names to Linear UUIDs
- **Flexible Input**: Accept both UUIDs and names for teams, projects, users, and states
- **Enhanced Responses**: API responses include both IDs and names for better usability
- **Default Project**: Automatically use a default project when none is specified in create requests

## Getting Your Linear API Key

1. Go to Linear Settings
2. Navigate to API section
3. Create a new API key
4. Copy the key to your `.env.local` file
