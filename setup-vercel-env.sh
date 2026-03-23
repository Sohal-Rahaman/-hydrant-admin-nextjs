#!/bin/bash

# This script helps set up environment variables on Vercel
# Run this script to add all environment variables to your Vercel project

echo "Setting up Vercel environment variables..."

# Add environment variables for production
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production <<< "AIzaSyC6IhpLeJMYGVL7BXxQ-h9Pyl4WNoL0RM4"
vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production <<< "hydrant-water-delivery.firebaseapp.com"
vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production <<< "hydrant-water-delivery"
vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET production <<< "hydrant-water-delivery.appspot.com"
vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID production <<< "257713282772"
vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production <<< "1:257713282772:web:3f2cad6b7d1a5690786541"
vercel env add NEXT_PUBLIC_MAPS_API_KEY production <<< "AIzaSyAv-Mt7wtm0flLEeQNyChQe4f4k_tivyZo"

echo "✅ Environment variables added successfully!"
echo "Now run: vercel --prod"
