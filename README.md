# iXplor

[![image](https://ixplor-profile-s3-bucket-02.s3.us-east-2.amazonaws.com/373bfa62bf4ee07e57b4e.png)](https://ixplor.app)
# iXplor Server

Backend API service for the iXplor adventure booking platform, built with Node.js and Express.

## Features

- **RESTful API**: Full CRUD operations for all resources
- **Authentication**: JWT-based auth with role-based access control
- **File Handling**: Support for image uploads and management
- **Payment Integration**: Stripe payment processing
- **Location Services**: Geospatial queries and filtering
- **Email Service**: Automated notifications and confirmations
- **Admin Functions**: Comprehensive admin management tools

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT, Passport.js
- **File Storage**: AWS S3
- **Payment Processing**: Stripe
- **Email Service**: SendGrid
- **Testing**: Jest
- **Documentation**: Swagger/OpenAPI

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ixplor-server.git
```

2. Install dependencies:
```bash
cd ixplor-server
npm install
```

3. Set up environment variables:
```env
PORT=3000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
STRIPE_SECRET_KEY=your_stripe_key
SENDGRID_API_KEY=your_sendgrid_key
```

4. Start the server:
```bash
npm run dev
```

## API Documentation

Available at `/api-docs` when running the server. Key endpoints:

- `/api/auth`: Authentication routes
- `/api/vendors`: Vendor management
- `/api/products`: Product CRUD operations
- `/api/bookings`: Booking management
- `/api/users`: User administration
- `/api/payments`: Payment processing

## Project Structure

```
src/
├── config/             # Configuration files
├── controllers/        # Route controllers
├── middleware/         # Custom middleware
├── models/            # Mongoose models
├── routes/            # API routes
├── services/          # Business logic
└── utils/             # Helper functions
```

## Development Guidelines

- Follow ESLint and Prettier configurations
- Write unit tests for new features
- Document all API endpoints
- Use async/await for asynchronous operations
- Implement proper error handling

## Environment Variables

Required environment variables:

- `PORT`: Server port number
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: JWT signing secret
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `STRIPE_SECRET_KEY`: Stripe API key
- `SENDGRID_API_KEY`: SendGrid API key

## Testing

Run tests with:
```bash
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

