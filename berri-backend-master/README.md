# Berri Backend API

A NestJS-based backend API for the Berri mobile application that provides document scanning and cloud storage integration.

## Features

- **Authentication & Authorization**
  - User registration and login
  - Email verification
  - Password reset functionality
  - Social login (Google, Apple, Facebook)
  - JWT-based authentication

- **User Management**
  - User CRUD operations
  - Profile management
  - Cloud storage links (Google Drive, OneDrive, Dropbox)

- **API Documentation**
  - Swagger/OpenAPI documentation
  - JWT Bearer authentication support

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT, Passport.js
- **Documentation**: Swagger/OpenAPI
- **Email**: Nodemailer
- **Social Auth**: Google OAuth, Apple Sign-In, Facebook Login

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd berri-backend
```

2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-password
DB_NAME=berri

# JWT
JWT_SECRET=your-secret-key

# Social Auth
GOOGLE_CLIENT_ID=your-google-client-id
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

5. Start the development server:

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000` and the Swagger documentation at `http://localhost:3000/api`.

## API Endpoints

### Authentication

- `POST /v1/auth/register` - User registration
- `POST /v1/auth/login` - User login
- `POST /v1/auth/logout` - User logout
- `POST /v1/auth/forgot-password` - Request password reset
- `POST /v1/auth/reset-password` - Reset password with token
- `POST /v1/auth/verify-email` - Verify email address
- `GET /v1/auth/profile` - Get current user profile

### Social Authentication

- `POST /v1/auth/google` - Google OAuth login
- `POST /v1/auth/apple` - Apple Sign-In login
- `POST /v1/auth/facebook` - Facebook login

### Users

- `GET /v1/users` - Get all users (admin)
- `GET /v1/users/me` - Get current user
- `GET /v1/users/:id` - Get user by ID
- `PUT /v1/users/:id` - Update user
- `DELETE /v1/users/:id` - Delete user

## Database Schema

### User Entity

- `id` - Primary key
- `email` - Unique email address
- `password` - Hashed password
- `name` - User's name
- `emailVerified` - Email verification status
- `googleDriveLink` - Google Drive integration
- `oneDriveLink` - OneDrive integration
- `dropboxLink` - Dropbox integration
- `newsletter` - Newsletter subscription status
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

## Social Authentication Setup

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add your domain to authorized origins

### Apple Sign-In

1. Go to [Apple Developer Console](https://developer.apple.com/)
2. Register your app
3. Enable Sign in with Apple capability
4. Configure your app's bundle ID

### Facebook Login

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add Facebook Login product
4. Configure OAuth redirect URIs

## Development

### Available Scripts

- `npm run start` - Start production server
- `npm run start:dev` - Start development server with hot reload
- `npm run start:debug` - Start server in debug mode
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Lint code

### Project Structure

```
src/
├── auth/           # Authentication module
├── users/          # User management module
├── email/          # Email service module
├── google-auth/    # Google OAuth module
├── apple-auth/     # Apple Sign-In module
├── facebook-auth/  # Facebook login module
└── main.ts         # Application entry point
```

## Docker Support

### Development

```bash
docker-compose up -d
```

### Production

```bash
docker-compose -f docker-compose-prod.yml up -d
```

## Security

- Passwords are hashed using bcrypt
- JWT tokens expire after 24 hours
- Email verification required for new accounts
- Rate limiting on authentication endpoints
- CORS enabled for security

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if needed
5. Submit a pull request

## License

This project is licensed under the MIT License.

  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ yarn install
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Run tests

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ yarn install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
