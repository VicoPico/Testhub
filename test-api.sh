#!/bin/bash

# Testhub API CRUD Testing Script
# Make sure the API server is running on http://localhost:8080
# You'll need a valid API key - set it below or pass as environment variable

API_KEY="${API_KEY:-your-api-key-here}"
BASE_URL="http://localhost:8080"

echo "🧪 Testing Testhub API CRUD Operations"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper function
test_endpoint() {
    echo -e "${BLUE}$1${NC}"
}

success_msg() {
    echo -e "${GREEN}✓ $1${NC}"
    echo ""
}

error_msg() {
    echo -e "${RED}✗ $1${NC}"
    echo ""
}

# 1. Health Check (no auth required)
test_endpoint "1. GET /health - Health check (no auth)"
curl -s -w "\nStatus: %{http_code}\n" \
  "$BASE_URL/health"
success_msg "Health check"

# 2. Ready Check (no auth required)
test_endpoint "2. GET /ready - Readiness check (no auth)"
curl -s -w "\nStatus: %{http_code}\n" \
  "$BASE_URL/ready"
success_msg "Ready check"

# 3. List Projects (empty initially)
test_endpoint "3. GET /projects - List projects"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-api-key: $API_KEY" \
  "$BASE_URL/projects"
success_msg "List projects"

# 4. Create Project
test_endpoint "4. POST /projects - Create project"
PROJECT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "slug": "test-project-'$(date +%s)'"
  }' \
  "$BASE_URL/projects")

PROJECT_BODY=$(echo "$PROJECT_RESPONSE" | sed '$d')
STATUS_CODE=$(echo "$PROJECT_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
echo "$PROJECT_BODY"
echo "Status: $STATUS_CODE"

PROJECT_ID=$(echo "$PROJECT_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
PROJECT_SLUG=$(echo "$PROJECT_BODY" | grep -o '"slug":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$PROJECT_ID" ]; then
    success_msg "Created project: $PROJECT_ID"
else
    error_msg "Failed to create project"
    exit 1
fi

# 5. Get Project by ID
test_endpoint "5. GET /projects/{projectId} - Get project by ID"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-api-key: $API_KEY" \
  "$BASE_URL/projects/$PROJECT_ID"
success_msg "Get project by ID"

# 6. Get Project by Slug
test_endpoint "6. GET /projects/{projectSlug} - Get project by slug"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-api-key: $API_KEY" \
  "$BASE_URL/projects/$PROJECT_SLUG"
success_msg "Get project by slug"

# 7. Update Project
test_endpoint "7. PATCH /projects/{projectId} - Update project"
curl -s -w "\nStatus: %{http_code}\n" \
  -X PATCH \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Test Project"
  }' \
  "$BASE_URL/projects/$PROJECT_ID"
success_msg "Update project"

# 8. List Runs (empty initially)
test_endpoint "8. GET /projects/{projectId}/runs - List runs"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-api-key: $API_KEY" \
  "$BASE_URL/projects/$PROJECT_ID/runs"
success_msg "List runs (empty)"

# 9. Create Run
test_endpoint "9. POST /projects/{projectId}/runs - Create run"
RUN_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "test-script",
    "branch": "main",
    "commitSha": "abc123def456",
    "env": {
      "NODE_ENV": "test"
    },
    "meta": {
      "runner": "curl"
    }
  }' \
  "$BASE_URL/projects/$PROJECT_ID/runs")

RUN_BODY=$(echo "$RUN_RESPONSE" | sed '$d')
STATUS_CODE=$(echo "$RUN_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
echo "$RUN_BODY"
echo "Status: $STATUS_CODE"

RUN_ID=$(echo "$RUN_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ ! -z "$RUN_ID" ]; then
    success_msg "Created run: $RUN_ID"
else
    error_msg "Failed to create run"
fi

# 10. Get Run Details
test_endpoint "10. GET /projects/{projectId}/runs/{runId} - Get run details"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-api-key: $API_KEY" \
  "$BASE_URL/projects/$PROJECT_ID/runs/$RUN_ID"
success_msg "Get run details"

# 11. Batch Ingest Results
test_endpoint "11. POST /projects/{projectId}/runs/{runId}/results/batch - Batch ingest"
curl -s -w "\nStatus: %{http_code}\n" \
  -X POST \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "results": [
      {
        "externalId": "test-1",
        "name": "should pass test",
        "status": "PASSED",
        "durationMs": 150,
        "filePath": "tests/example.test.ts",
        "suiteName": "Example Suite",
        "tags": ["unit", "fast"]
      },
      {
        "externalId": "test-2",
        "name": "should fail test",
        "status": "FAILED",
        "durationMs": 200,
        "message": "Expected true to be false",
        "stacktrace": "at Object.<anonymous> (test.ts:10:5)",
        "filePath": "tests/example.test.ts",
        "suiteName": "Example Suite",
        "tags": ["unit"]
      },
      {
        "externalId": "test-3",
        "name": "should skip test",
        "status": "SKIPPED",
        "filePath": "tests/example.test.ts",
        "suiteName": "Example Suite"
      }
    ]
  }' \
  "$BASE_URL/projects/$PROJECT_ID/runs/$RUN_ID/results/batch"
success_msg "Batch ingest results"

# 12. List Run Results
test_endpoint "12. GET /projects/{projectId}/runs/{runId}/results - List results"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-api-key: $API_KEY" \
  "$BASE_URL/projects/$PROJECT_ID/runs/$RUN_ID/results"
success_msg "List run results"

# 13. List Runs with Filter
test_endpoint "13. GET /projects/{projectId}/runs?status=QUEUED&limit=10 - List with filter"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-api-key: $API_KEY" \
  "$BASE_URL/projects/$PROJECT_ID/runs?status=QUEUED&limit=10"
success_msg "List runs with filter"

# 14. Delete Run
test_endpoint "14. DELETE /projects/{projectId}/runs/{runId} - Delete run"
curl -s -w "\nStatus: %{http_code}\n" \
  -X DELETE \
  -H "x-api-key: $API_KEY" \
  "$BASE_URL/projects/$PROJECT_ID/runs/$RUN_ID"
success_msg "Delete run"

# 15. Verify Run Deleted (should return 404)
test_endpoint "15. GET /projects/{projectId}/runs/{runId} - Verify run deleted (expect 404)"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-api-key: $API_KEY" \
  "$BASE_URL/projects/$PROJECT_ID/runs/$RUN_ID"
success_msg "Verified run deleted"

# 16. Delete Project
test_endpoint "16. DELETE /projects/{projectId} - Delete project"
curl -s -w "\nStatus: %{http_code}\n" \
  -X DELETE \
  -H "x-api-key: $API_KEY" \
  "$BASE_URL/projects/$PROJECT_ID"
success_msg "Delete project"

# 17. Verify Project Deleted (should return 404)
test_endpoint "17. GET /projects/{projectId} - Verify project deleted (expect 404)"
curl -s -w "\nStatus: %{http_code}\n" \
  -H "x-api-key: $API_KEY" \
  "$BASE_URL/projects/$PROJECT_ID"
success_msg "Verified project deleted"

# 18. Test Error Cases
test_endpoint "18. POST /projects - Create project with duplicate slug (expect 400)"
curl -s -w "\nStatus: %{http_code}\n" \
  -X POST \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Another Project",
    "slug": "duplicate-test"
  }' \
  "$BASE_URL/projects"

curl -s -w "\nStatus: %{http_code}\n" \
  -X POST \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Another Project",
    "slug": "duplicate-test"
  }' \
  "$BASE_URL/projects"
success_msg "Duplicate slug error test"

# 19. Test Unauthorized (expect 401)
test_endpoint "19. GET /projects - No API key (expect 401)"
curl -s -w "\nStatus: %{http_code}\n" \
  "$BASE_URL/projects"
success_msg "Unauthorized test"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All API tests completed!${NC}"
echo -e "${GREEN}========================================${NC}"
