# Spellcast - Linear API Integration

A Next.js application that provides a RESTful API interface for managing Linear issues with API key authentication.

## Features

- 🔐 API Key authentication (Bearer token or query parameter)
- 📝 Create, read, update, and search Linear issues
- ✅ Input validation using Yup schemas
- 🚀 Next.js 14 with App Router
- 📘 TypeScript support

## Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   
   Copy `.env.example` to `.env.local` and fill in your API keys:
   ```bash
   cp .env.example .env.local
   ```
   
   Update the values in `.env.local`:
   ```env
   # Your application's API key for authentication
   API_KEY=your_secure_api_key_here
   
   # Linear API key - Get this from https://linear.app/settings/api
   LINEAR_API_KEY=your_linear_api_key_here
   ```

3. **Get your Linear API key:**
   - Go to [Linear Settings > API](https://linear.app/settings/api)
   - Create a new Personal API Key
   - Copy the key to your `.env.local` file

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## Authentication

All API endpoints require authentication via API key. You can provide the API key in two ways:

### 1. Authorization Header (Recommended)
```bash
curl -H "Authorization: Bearer your_api_key" http://localhost:3000/api/linear/list
```

### 2. Query Parameter
```bash
curl "http://localhost:3000/api/linear/list?Bearer=your_api_key"
```

## API Endpoints

### Create Issue
**POST** `/api/linear/create`

Create a new Linear issue.

**Request Body:**
```json
{
  "title": "Issue title",
  "description": "Issue description (optional)",
  "teamId": "team-id-here",
  "assigneeId": "user-id-here (optional)",
  "priority": 2,
  "labelIds": ["label-1", "label-2"],
  "projectId": "project-id-here (optional)",
  "stateId": "state-id-here (optional)"
}
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"title": "Fix login bug", "teamId": "your-team-id"}' \
  http://localhost:3000/api/linear/create
```

### Get Issue
**GET** `/api/linear/{issueId}`

Retrieve a specific issue by ID.

**Example:**
```bash
curl -H "Authorization: Bearer your_api_key" \
  http://localhost:3000/api/linear/issue-id-here
```

### Update Issue
**PUT** `/api/linear/{issueId}`

Update an existing issue.

**Request Body (all fields optional):**
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "assigneeId": "new-assignee-id",
  "priority": 1,
  "stateId": "new-state-id"
}
```

**Example:**
```bash
curl -X PUT \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated title", "priority": 1}' \
  http://localhost:3000/api/linear/issue-id-here
```

### Search Issues
**GET** `/api/linear/search`

Search for issues with various filters.

**Query Parameters:**
- `query` - Text search in title/description
- `teamId` - Filter by team ID
- `assigneeId` - Filter by assignee ID
- `stateId` - Filter by state ID
- `projectId` - Filter by project ID
- `limit` - Number of results (1-100, default: 50)
- `offset` - Pagination offset

**Example:**
```bash
curl -H "Authorization: Bearer your_api_key" \
  "http://localhost:3000/api/linear/search?query=bug&teamId=your-team-id&limit=10"
```

### List Issues
**GET** `/api/linear/list`

List all issues with pagination.

**Query Parameters:**
- `limit` - Number of results (1-100, default: 50)
- `offset` - Pagination offset
- `teamId` - Filter by team ID (optional)

**Example:**
```bash
curl -H "Authorization: Bearer your_api_key" \
  "http://localhost:3000/api/linear/list?limit=20&teamId=your-team-id"
```

## Response Format

All endpoints return responses in the following format:

**Success Response:**
```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Issue Data Structure

Issues are returned with the following structure:

```json
{
  "id": "issue-id",
  "title": "Issue title",
  "description": "Issue description",
  "number": 123,
  "url": "https://linear.app/team/issue/ABC-123",
  "priority": 2,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Development

The project structure:

```
src/
├── app/
│   └── api/
│       └── linear/           # API routes
├── lib/
│   ├── auth.ts              # Authentication utilities
│   └── linear.ts            # Linear client setup
├── models/
│   └── issueSchemas.ts      # Yup validation schemas
└── middleware.ts            # API authentication middleware
```

## Error Handling

- **400 Bad Request**: Invalid input data or validation errors
- **401 Unauthorized**: Missing or invalid API key
- **404 Not Found**: Issue not found
- **500 Internal Server Error**: Server-side errors

## Security

- API keys are validated on all requests
- Input validation using Yup schemas
- Environment variables for sensitive data
- No API keys logged or exposed in responses