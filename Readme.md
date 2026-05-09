# ToroHR Backend

Backend authentication setup for the ToroHR HRMS application.

## Tech Stack

- Node.js
- MongoDB
- JWT

## Folder Structure

```text
src/
|-- config/
|-- controllers/
|-- routes/
|-- services/
|-- dtos/
|-- models/
|-- middlewares/
|-- utils/
`-- server.js
```

## Installation

```bash
npm install
```

## Environment Variables

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/torohr
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d
```

## Run

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```
