#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import open from 'open';

// ==============================
// CONFIGURATION
// ==============================
const CLIENT_ID = '0ca2b0ba92fb4fe9afab0db4e07e071f'; 
const REDIRECT_URI = 'http://127.0.0.1:3000/callback';
const SCOPES = [
  'ugc-image-upload', 'user-read-playback-state', 'user-modify-playback-state',
  'user-read-currently-playing', 'app-remote-control', 'streaming',
  'playlist-read-private', 'playlist-read-collaborative',
  'playlist-modify-private', 'playlist-modify-public',
  'user-follow-modify', 'user-follow-read', 'user-library-read',
  'user-library-modify', 'user-read-email', 'user-read-private',
  'user-top-read', 'user-read-recently-played', 'user-read-playback-position'
].join(' ');

// ==============================
// PKCE HELPERS
// ==============================
function generateCodeVerifier() {
  return crypto.randomBytes(64).toString('hex');
}

function generateCodeChallenge(codeVerifier) {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  return hash.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ==============================
// LOGIN COMMAND
// ==============================
async function handleLoginCommand() {
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);

  const authURL = `https://accounts.spotify.com/authorize?` + new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge
  });

  console.log('Opening browser to authenticate with Spotify...');
  await open(authURL);

  const app = express();

  app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
      res.status(400).send('Missing authorization code.');
      return;
    }

    try {
      const tokenRes = await axios.post('https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          code_verifier: verifier
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const { access_token, refresh_token, expires_in } = tokenRes.data;

      console.log('\n✅ Logged in successfully!');

      res.send('✅ Login complete! You may close this window.');

      setTimeout(() => {
        process.exit(0);
      }, 1000);

    } catch (err) {
      console.error('Token exchange failed:', err.response?.data || err.message);
      res.status(500).send('Failed to retrieve tokens.');
    }
  });

// =============================
// USER'S TOP SONGS
// =============================

async function handleUserTopSongs(
  limit,
  time_range,
  ) {
    if (time_range === "short") {
      const time = "short_term";
    } else if (time_range === "medium") {
      const time = "medium_term";
    } else if (time_range === "long") {
      const time = "long_term";
    } else {
      console.log("Invalid time input!")
    }
    data = axios.get(`https://api.spotify.com/v1/me/top/tracks?
    time_range=${time}&limit=${limit}`, );
}


  app.listen(3000, () => {
    console.log('📡 Waiting on http://localhost:3000...');
  });
}

// ==============================
// YARGS CLI SETUP
// ==============================
yargs(hideBin(process.argv))
  .command('login', 'Authenticate with Spotify via PKCE', {}, handleLoginCommand)
  .demandCommand(1, 'Please provide a valid command')
  .strict()
  .help()
  .argv;
