# Name-to-ID Translation API Demo

This document demonstrates the new name-to-ID translation functionality implemented in the Spellcast Linear API.

## ✨ Features Implemented

### 🔄 **Automatic Entity Resolution**
- **Teams**: Accept team names, keys, or UUIDs (e.g., "Engineering", "ENG", or UUID)
- **Users**: Accept usernames, emails, display names, or UUIDs (e.g., "john@example.com", "John Doe", or UUID)
- **Projects**: Accept project names or UUIDs (e.g., "Spellcast Backend" or UUID)
- **States**: Accept state names or UUIDs (e.g., "In Progress", "Done", or UUID)

### 📊 **Enhanced Responses**
All API responses now include both IDs and human-readable names:

```json
{
  "success": true,
  "data": {
    "id": "issue-uuid-123",
    "title": "Fix authentication bug",
    "team": {
      "id": "team-uuid-456",
      "name": "Engineering", 
      "key": "ENG"
    },
    "assignee": {
      "id": "user-uuid-789",
      "name": "John Doe",
      "displayName": "John",
      "email": "john@example.com"
    },
    "project": {
      "id": "project-uuid-abc",
      "name": "Spellcast Backend"
    },
    "state": {
      "id": "state-uuid-def",
      "name": "In Progress",
      "type": "started",
      "color": "#FFA500"
    }
  }
}
```

### 🚀 **Environment Configuration**
Set `DEFAULT_PROJECT_ID` in your `.env.local`:

```bash
# Using project name (recommended)
DEFAULT_PROJECT_ID=Spellcast Backend

# Or using UUID
DEFAULT_PROJECT_ID=12345678-1234-1234-1234-123456789abc
```

## 🧪 **API Examples**

### Create Issue with Names
```bash
# Before: Required UUIDs
curl -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix login bug",
    "teamId": "12345678-1234-1234-1234-123456789abc",
    "assigneeId": "87654321-4321-4321-4321-fedcba987654"
  }' \
  http://localhost:3001/api/linear/create

# After: Use human-readable names!
curl -X POST -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix login bug",
    "teamId": "Engineering",
    "assigneeId": "john@example.com"
  }' \
  http://localhost:3001/api/linear/create
```

### Search with Names
```bash
# Search by team name and assignee email
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:3001/api/linear/search?teamId=Engineering&assigneeId=john@example.com&stateId=In Progress"

# Search response includes resolved entity information
{
  "success": true,
  "data": {
    "issues": [...],
    "appliedFilters": {
      "team": {
        "id": "team-uuid-123",
        "name": "Engineering",
        "key": "ENG"
      },
      "assignee": {
        "id": "user-uuid-456", 
        "name": "John Doe",
        "displayName": "John",
        "email": "john@example.com"
      },
      "state": {
        "id": "state-uuid-789",
        "name": "In Progress",
        "type": "started",
        "color": "#FFA500"
      }
    }
  }
}
```

### List with Team Name
```bash
# List issues for a team by name
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:3001/api/linear/list?teamId=Engineering"
```

## ✅ **Error Handling**

The API provides helpful error messages when entities aren't found:

```json
{
  "success": false,
  "error": "Team 'NonExistentTeam' not found"
}
```

```json
{
  "success": false,
  "error": "Assignee 'unknown@example.com' not found"
}
```

## 🔧 **Implementation Features**

- **Caching**: Entity lookups are cached for 5 minutes to improve performance
- **Flexible Input**: Accept both UUIDs and names for all entity types
- **Error Handling**: Clear error messages when entities aren't found
- **Backward Compatible**: Existing UUID-based requests continue to work
- **Enhanced Responses**: All responses include both IDs and names

## 📈 **Performance Benefits**

- **Developer Experience**: No need to manually look up entity IDs
- **API Usability**: Human-readable parameters and responses
- **Reduced Friction**: Direct use of names, emails, and team keys
- **Intelligent Caching**: Automatic performance optimization

---

🎉 **The API is now much more user-friendly while maintaining full backward compatibility!**
