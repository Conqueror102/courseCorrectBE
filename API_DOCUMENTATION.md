# Backend API Documentation

**Base URL:** `/api`

---

## Authentication

All protected routes require the `Authorization` header:
```
Authorization: Bearer <accessToken>
```

Tokens are returned on successful login/registration. Access tokens expire in 15 minutes, refresh tokens in 7 days.

---

## Enums Reference

```typescript
Role: "ADMIN" | "STUDENT"
Level: "L_100" | "L_200" | "L_300" | "L_400" | "L_500"
Semester: "FIRST" | "SECOND"
ContentType: "VIDEO" | "AUDIO" | "PDF"
AccessMode: "DIRECT" | "PASSKEY"
```

---

## 1. Authentication Endpoints

### 1.1 Register Student
Creates a new student account.

**Endpoint:** `POST /api/auth/register`  
**Access:** Public

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Success Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid-string",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "STUDENT"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error Responses:**
- `400` - User already exists
- `500` - Server error

---

### 1.2 Login
Authenticates user and returns tokens.

**Endpoint:** `POST /api/auth/login`  
**Access:** Public

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Success Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid-string",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "STUDENT"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error Responses:**
- `401` - Invalid credentials
- `500` - Server error

---

### 1.3 Activate Passkey
Activates platform access using a passkey code. Creates 30-day enrollment.

**Endpoint:** `POST /api/auth/activate-passkey`  
**Access:** Protected (Student)

**Request Body:**
```json
{
  "passkey": "ABC-123-XYZ"
}
```

**Success Response:** `200 OK`
```json
{
  "message": "Access activated successfully against global content for 30 days."
}
```

**Error Responses:**
- `401` - Unauthorized
- `404` - Invalid passkey
- `400` - Passkey already used
- `500` - Activation failed

---

## 2. Student Endpoints

### 2.1 Get Dashboard
Returns student's access status and platform content statistics.

**Endpoint:** `GET /api/student/dashboard`  
**Access:** Protected (Student)

**Success Response:** `200 OK`
```json
{
  "accessStatus": "active",
  "daysRemaining": 25,
  "expiresAt": "2026-02-05T23:59:59.000Z",
  "activationDate": "2026-01-06T10:30:00.000Z",
  "contentCounts": {
    "video": 45,
    "audio": 12,
    "pdf": 8
  }
}
```

**Access Status Values:**
- `"active"` - User has valid platform access
- `"inactive"` - User never had access
- `"expired"` - Access period has ended

**Error Responses:**
- `401` - Unauthorized
- `500` - Server error

---

### 2.2 Get Recently Added Courses/Lessons
Returns the latest courses and/or lessons available to a student with active access.

**Endpoint:** `GET /api/student/recent-content`  
**Access:** Protected (Student with active platform access)

**Query Parameters (optional):**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | `all` | `courses`, `lessons`, or `all` |
| `limit` | number | `5` | Number of items per list (1–20) |

**Example:** `GET /api/student/recent-content?type=lessons&limit=3`

**Success Response:** `200 OK`
```json
{
  "courses": [
    {
      "id": "course-uuid",
      "code": "CSC101",
      "title": "Introduction to Computer Science",
      "description": "Fundamentals of computing...",
      "level": "L_100",
      "semester": "FIRST",
      "session": "2024/2025",
      "createdAt": "2026-01-06T10:00:00.000Z"
    }
  ],
  "lessons": [
    {
      "id": "lesson-uuid",
      "title": "Introduction to Variables",
      "description": "Learn about variables",
      "type": "VIDEO",
      "createdAt": "2026-01-06T11:00:00.000Z",
      "course": {
        "id": "course-uuid",
        "code": "CSC101",
        "title": "Introduction to Computer Science"
      }
    }
  ]
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Access Denied: No active platform access
- `500` - Failed to fetch recent content

---

## 3. Payment Endpoints

### 3.1 Initialize Payment
Initiates Paystack payment for platform-wide access.

**Endpoint:** `POST /api/payments/initialize`  
**Access:** Protected (Student)

**Request Body:** None required (empty object `{}`)

**Success Response:** `200 OK`
```json
{
  "authorization_url": "https://checkout.paystack.com/abc123xyz",
  "access_code": "abc123xyz",
  "reference": "ref_1234567890"
}
```

**Frontend Flow:**
1. Call this endpoint
2. Redirect user to `authorization_url`
3. Paystack handles payment
4. Webhook processes result automatically
5. User gets platform access (DIRECT mode) or passkey via email (PASSKEY mode)

**Error Responses:**
- `401` - Unauthorized
- `404` - User not found
- `500` - Payment init failed

---

### 3.2 Verify Payment
Manually verify a payment status (useful as fallback if webhook fails).

**Endpoint:** `GET /api/payments/verify/:reference`  
**Access:** Protected (Student)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| reference | string | Payment reference from initialize |

**Success Response:** `200 OK`
```json
{
  "status": "success",
  "message": "Payment verified"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Not your payment
- `404` - Payment not found
- `500` - Verification failed

---

### 3.3 Paystack Webhook
Handles Paystack payment notifications. Called by Paystack servers.

**Endpoint:** `POST /api/payments/webhook`  
**Access:** Public (verified by Paystack signature)

**Note:** This is called automatically by Paystack. Frontend does not call this directly.

---

## 4. Course Endpoints

### 4.1 List Courses
Returns all courses with optional filters.

**Endpoint:** `GET /api/courses`  
**Access:** Public

**Query Parameters (all optional):**
| Parameter | Type | Example | Description |
|-----------|------|---------|-------------|
| level | string | `L_100` | Filter by level |
| semester | string | `FIRST` | Filter by semester |
| session | string | `2024/2025` | Filter by academic session |

**Example:** `GET /api/courses?level=L_100&semester=FIRST`

**Success Response:** `200 OK`
```json
[
  {
    "id": "uuid-string",
    "code": "CSC101",
    "title": "Introduction to Computer Science",
    "description": "Fundamentals of computing...",
    "level": "L_100",
    "semester": "FIRST",
    "session": "2024/2025",
    "lecturer": "Dr. Smith",
    "price": 5000,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "_count": {
      "lessons": 12
    }
  }
]
```

---

### 4.2 Create Course (Admin)
Creates a new course.

**Endpoint:** `POST /api/courses`  
**Access:** Protected (Admin only)

**Request Body:**
```json
{
  "title": "Introduction to Computer Science",
  "code": "CSC101",
  "description": "Fundamentals of computing and programming",
  "level": "L_100",
  "semester": "FIRST",
  "session": "2024/2025",
  "lecturer": "Dr. Smith",
  "price": 5000
}
```

**Success Response:** `201 Created`
```json
{
  "id": "uuid-string",
  "code": "CSC101",
  "title": "Introduction to Computer Science",
  "description": "Fundamentals of computing and programming",
  "level": "L_100",
  "semester": "FIRST",
  "session": "2024/2025",
  "lecturer": "Dr. Smith",
  "price": 5000,
  "createdAt": "2026-01-06T10:00:00.000Z",
  "updatedAt": "2026-01-06T10:00:00.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (not admin)
- `409` - Course already exists for this session/semester/level
- `500` - Server error

---

### 4.3 Update Course (Admin)
Updates an existing course.

**Endpoint:** `PUT /api/courses/:id`  
**Access:** Protected (Admin only)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Course UUID |

**Request Body (all fields optional):**
```json
{
  "title": "Updated Course Title",
  "description": "Updated description",
  "code": "CSC102",
  "level": "L_200",
  "semester": "SECOND",
  "session": "2025/2026",
  "lecturer": "Dr. Johnson",
  "price": 7500
}
```

**Success Response:** `200 OK`
```json
{
  "id": "uuid-string",
  "code": "CSC102",
  "title": "Updated Course Title",
  "description": "Updated description",
  "level": "L_200",
  "semester": "SECOND",
  "session": "2025/2026",
  "lecturer": "Dr. Johnson",
  "price": 7500,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-06T12:00:00.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Course not found
- `500` - Failed to update

---

### 4.4 Delete Course (Admin)
Deletes a course by ID.

**Endpoint:** `DELETE /api/courses/:id`  
**Access:** Protected (Admin only)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Course UUID |

**Success Response:** `200 OK`
```json
{
  "message": "Course deleted"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden
- `500` - Failed to delete

---

## 5. Content/Lesson Endpoints

### 5.1 Get Upload URL (Admin)
Gets pre-signed upload URL for content upload.

**Endpoint:** `POST /api/content/upload-url`  
**Access:** Protected (Admin only)

**Request Body:**
```json
{
  "type": "VIDEO"
}
```

**Type Values:** `"VIDEO"`, `"AUDIO"`, `"PDF"`

**Success Response for VIDEO:** `200 OK`
```json
{
  "url": "https://storage.googleapis.com/mux-uploads/...",
  "type": "mux"
}
```
*Upload video binary directly to this URL via PUT request.*

**Success Response for AUDIO/PDF:** `200 OK`
```json
{
  "timestamp": 1704538800,
  "signature": "abc123signature...",
  "api_key": "cloudinary_api_key",
  "type": "cloudinary"
}
```
*Use Cloudinary SDK with these credentials to upload.*

---

### 5.2 Create Lesson (Admin)
Creates lesson metadata after file upload.

**Endpoint:** `POST /api/content`  
**Access:** Protected (Admin only)

**Request Body:**
```json
{
  "title": "Introduction to Variables",
  "description": "Learn about variables and data types",
  "courseCode": "CSC101",
  "level": "L_100",
  "semester": "FIRST",
  "academicSession": "2024/2025",
  "type": "VIDEO",
  "uploadId": "mux_upload_id_here",
  "instructions": "Watch carefully and take notes"
}
```

**For VIDEO content:**
```json
{
  "type": "VIDEO",
  "uploadId": "mux_upload_id_from_step1"
}
```

**For AUDIO/PDF content:**
```json
{
  "type": "PDF",
  "publicId": "cloudinary_public_id_from_upload"
}
```

**Success Response:** `201 Created`
```json
{
  "id": "uuid-string",
  "fileUrl": "mux:playback_id_here",
  "uploadedAt": "2026-01-06T10:00:00.000Z",
  "metadata": {
    "title": "Introduction to Variables",
    "description": "Learn about variables and data types",
    "courseCode": "CSC101",
    "level": "L_100",
    "semester": "FIRST",
    "academicSession": "2024/2025",
    "type": "VIDEO"
  }
}
```

---

### 5.3 Get All Lessons (Admin)
Returns paginated list of all lessons across the platform.

**Endpoint:** `GET /api/content/all`  
**Access:** Protected (Admin only)

**Query Parameters (all optional):**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| type | string | - | Filter by content type (`VIDEO`, `AUDIO`, `PDF`) |
| courseId | string | - | Filter by course UUID |

**Example:** `GET /api/content/all?page=1&limit=10&type=VIDEO`

**Success Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid-string",
      "title": "Introduction to Variables",
      "description": "Learn about variables and data types",
      "type": "VIDEO",
      "fileUrl": "mux:playback_id",
      "fileSize": 0,
      "instructions": "Watch carefully",
      "courseId": "course-uuid",
      "createdAt": "2026-01-06T10:00:00.000Z",
      "updatedAt": "2026-01-06T10:00:00.000Z",
      "course": {
        "id": "course-uuid",
        "code": "CSC101",
        "title": "Introduction to Computer Science"
      }
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (not admin)
- `500` - Error fetching lessons

---

### 5.4 Get Course Lessons
Lists all lessons for a course (metadata only, no URLs).

**Endpoint:** `GET /api/content/course/:courseId`  
**Access:** Protected (Student with active platform access OR Admin)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| courseId | string | Course UUID |

**Success Response:** `200 OK`
```json
[
  {
    "id": "uuid-string",
    "title": "Introduction to Variables",
    "type": "VIDEO",
    "description": "Learn about variables and data types",
    "createdAt": "2026-01-06T10:00:00.000Z"
  },
  {
    "id": "uuid-string-2",
    "title": "Course Notes",
    "type": "PDF",
    "description": "Downloadable course materials",
    "createdAt": "2026-01-06T11:00:00.000Z"
  }
]
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Access Denied: No active platform access

---

### 5.5 Get Lesson Details (Play/View)
Gets lesson with signed/tokenized URL for playback.

**Endpoint:** `GET /api/content/:id`  
**Access:** Protected (Student with active platform access OR Admin)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Lesson UUID |

**Success Response:** `200 OK`
```json
{
  "id": "uuid-string",
  "title": "Introduction to Variables",
  "description": "Learn about variables and data types",
  "type": "VIDEO",
  "fileUrl": "https://stream.mux.com/playback_id.m3u8?token=...",
  "fileSize": 0,
  "instructions": "Watch carefully and take notes",
  "courseId": "course-uuid",
  "createdAt": "2026-01-06T10:00:00.000Z",
  "updatedAt": "2026-01-06T10:00:00.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Access Denied: Enrollment required or expired
- `404` - Lesson not found

---

### 5.6 Update Lesson (Admin)
Updates lesson metadata.

**Endpoint:** `PUT /api/content/:id`  
**Access:** Protected (Admin only)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Lesson UUID |

**Request Body (all fields optional):**
```json
{
  "title": "Updated Lesson Title",
  "description": "Updated description",
  "instructions": "Updated instructions for students"
}
```

**Success Response:** `200 OK`
```json
{
  "id": "uuid-string",
  "title": "Updated Lesson Title",
  "description": "Updated description",
  "type": "VIDEO",
  "fileUrl": "mux:playback_id",
  "fileSize": 0,
  "instructions": "Updated instructions for students",
  "courseId": "course-uuid",
  "createdAt": "2026-01-06T10:00:00.000Z",
  "updatedAt": "2026-01-06T12:00:00.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Lesson not found
- `500` - Failed to update

---

### 5.7 Delete Lesson (Admin)
Deletes a lesson.

**Endpoint:** `DELETE /api/content/:id`  
**Access:** Protected (Admin only)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Lesson UUID |

**Success Response:** `200 OK`
```json
{
  "message": "Lesson deleted"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden
- `500` - Failed to delete

---

## 6. Admin Endpoints

### 6.1 Get Dashboard Stats
Returns admin dashboard metrics and recent activity.

**Endpoint:** `GET /api/admin/dashboard`  
**Access:** Protected (Admin only)

**Success Response:** `200 OK`
```json
{
  "metrics": {
    "totalStudents": 150,
    "activeAccess": 85,
    "expiredAccess": 40,
    "unpaidStudents": 25
  },
  "recentActivity": [
    {
      "text": "John Doe enrolled in CSC101",
      "time": "2026-01-06T09:30:00.000Z",
      "type": "student_activated"
    }
  ]
}
```

---

### 6.2 List Students
Returns paginated list of students with access status.

**Endpoint:** `GET /api/admin/students`  
**Access:** Protected (Admin only)

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Items per page |
| search | string | - | Search by name or email |

**Example:** `GET /api/admin/students?page=1&limit=10&search=john`

**Success Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid-string",
      "name": "John Doe",
      "email": "john@example.com",
      "accessStatus": "active",
      "lastCourse": null,
      "expiresAt": "2026-02-05T23:59:59.000Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 10
  }
}
```

---

### 6.3 Manage Student
Perform actions on a student (disable, extend, delete).

**Endpoint:** `POST /api/admin/students/:id/action`  
**Access:** Protected (Admin only)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Student UUID |

**Request Body - Disable Access:**
```json
{
  "action": "disable"
}
```

**Request Body - Extend Access:**
```json
{
  "action": "extend",
  "days": 30
}
```

**Request Body - Delete Student:**
```json
{
  "action": "delete"
}
```

**Success Responses:** `200 OK`
```json
{ "message": "Access disabled" }
{ "message": "Access extended by 30 days" }
{ "message": "Student deleted" }
```

**Error Responses:**
- `400` - Invalid action
- `404` - No enrollment found for student
- `500` - Action failed

---

### 6.4 Grant Access (Manual)
Manually grants platform access to a student.

**Endpoint:** `POST /api/admin/grant-access`  
**Access:** Protected (Admin only)

**Request Body:**
```json
{
  "studentId": "student-uuid-string"
}
```

**Success Response (DIRECT mode):** `200 OK`
```json
{
  "message": "Access granted directly (Platform enrollment created)"
}
```

**Success Response (PASSKEY mode):** `200 OK`
```json
{
  "message": "Passkey generated",
  "passkey": "ABC-123-XYZ"
}
```

**Error Responses:**
- `404` - Student not found
- `500` - Failed to grant access

---

## 7. Settings Endpoints

### 7.1 Get Settings
Returns all system settings.

**Endpoint:** `GET /api/settings`  
**Access:** Protected (Admin only)

**Success Response:** `200 OK`
```json
{
  "ACCESS_MODE": "DIRECT",
  "PLATFORM_PRICE": "5000"
}
```

**Setting Keys:**
| Key | Values | Description |
|-----|--------|-------------|
| ACCESS_MODE | `DIRECT`, `PASSKEY` | How access is granted after payment |
| PLATFORM_PRICE | number string | Platform access price in Naira |

---

### 7.2 Update Setting
Updates a system setting.

**Endpoint:** `PUT /api/settings`  
**Access:** Protected (Admin only)

**Request Body:**
```json
{
  "key": "ACCESS_MODE",
  "value": "PASSKEY"
}
```

**Success Response:** `200 OK`
```json
{
  "key": "ACCESS_MODE",
  "value": "PASSKEY"
}
```

**Error Responses:**
- `400` - Invalid setting key
- `500` - Failed to update

---

## Error Response Format

All error responses follow this format:
```json
{
  "message": "Error description here"
}
```

Some errors may include additional details:
```json
{
  "message": "Failed to create course",
  "error": { ... }
}
```

---

## Authentication Flow

### Standard Payment Flow
```
1. POST /api/auth/register (or /login)
2. POST /api/payments/initialize
3. Redirect to authorization_url
4. User completes payment on Paystack
5. Webhook processes payment
6. If ACCESS_MODE = "DIRECT": User has immediate access
   If ACCESS_MODE = "PASSKEY": User receives passkey via email
7. (If PASSKEY) POST /api/auth/activate-passkey
8. User can now access all content
```

### Admin Manual Grant Flow
```
1. Admin logs in
2. POST /api/admin/grant-access { studentId }
3. If ACCESS_MODE = "DIRECT": Student has immediate access
   If ACCESS_MODE = "PASSKEY": Admin receives passkey to share
4. (If PASSKEY) Student calls POST /api/auth/activate-passkey
```

---

## Content Upload Flow (Admin)

```
1. POST /api/content/upload-url { type: "VIDEO" }
2. Upload file to returned URL:
   - VIDEO: PUT binary to Mux URL
   - AUDIO/PDF: Use Cloudinary SDK with signature
3. POST /api/content {
     title, description, courseCode, level, semester,
     academicSession, type, uploadId/publicId
   }
4. Lesson is created and associated with course
```

---

## Platform Access Model

- Users pay once for **platform-wide access** (not per-course)
- Access is valid for **30 days** from activation
- With active access, users can view **all courses and lessons**
- Admin can extend, disable, or manually grant access

---

## Environment Configuration

### Required Environment Variables

```env
# Server
PORT=4000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# JWT Authentication
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# Paystack Payment
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxx
```

### Email Configuration

The system supports two email providers. Set `EMAIL_PROVIDER` to choose:

**Option 1: SendGrid**
```env
EMAIL_PROVIDER=sendgrid
EMAIL_FROM=noreply@yourdomain.com
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
```

**Option 2: SMTP (Nodemailer)**
```env
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Common SMTP Providers:**
| Provider | Host | Port | Secure |
|----------|------|------|--------|
| Gmail | smtp.gmail.com | 587 | false |
| Outlook | smtp.office365.com | 587 | false |
| Yahoo | smtp.mail.yahoo.com | 587 | false |
| Zoho | smtp.zoho.com | 465 | true |

*Note: For Gmail, use an App Password (not your regular password). Enable 2FA first, then generate an App Password in Google Account settings.*

### Media Storage

**Mux (Video Streaming)**
```env
MUX_TOKEN_ID=your-token-id
MUX_TOKEN_SECRET=your-token-secret
MUX_SIGNING_KEY=your-signing-key-id
MUX_PRIVATE_KEY=base64-encoded-private-key
```

**Cloudinary (PDF/Audio)**
```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

*Important: Enable "Allow delivery of PDF and ZIP files" in Cloudinary Security settings.*

### Webhook Configuration

**Paystack Webhook:**
- URL: `https://yourdomain.com/api/payments/webhook`
- Events: `charge.success`

**Mux Webhook (optional):**
```env
MUX_WEBHOOK_SECRET=your-webhook-secret
```
