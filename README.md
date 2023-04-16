# HackNU2023

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## Visualization
[Click here](https://drive.google.com/drive/folders/13C7Y1xo809Yx3imUM4tW8mvVxKd0Z7tY?usp=sharing)

## Run locally

0. Make sure you have [Node.js](https://nodejs.org/en/) installed

1. Install dependencies

```bash
npm ci
```

2. Add a `.env` file with the following content:

```bash
DATABASE_URL=mysql://[DB_USER]:[DB_PASSWORD]@[DB_HOST]:[DB_PORTS]/[DB_NAME]
```

3. Push DB schema to your database

```bash
npx prisma db push
```

4. Start the development server

```bash
npm run dev
```
