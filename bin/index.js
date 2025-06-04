#!/usr/bin/env node

// import yargs from 'yargs';
// import { hideBin } from 'yargs/helpers';
import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import open from 'open';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from "chalk";
import inquirer from "inquirer";
import boxen from "boxen";

// ==============================
// CONFIGURATION
// ==============================
const tokens = {
  "access" : null,
  "refresh" : null
}
const TOKEN_FILE = path.join(os.homedir(), '.spotify-cli', 'tokens.json');
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
// ===============================
//  TOKEN LOGGING LOGIC
// ===============================
function saveTokensToFile(tokens) {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

function loadTokensFromFile() {
  if (!fs.existsSync(TOKEN_FILE)) {
    console.error(chalk.red('No saved tokens found. Please run: spotify-tool-cli login'));
    process.exit(1);
  }
  const raw = fs.readFileSync(TOKEN_FILE);
  return JSON.parse(raw);
}
// ==============================
//  WELCOME PAGE COMMAND
// ==============================
async function handleWelcomePage() {

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

  console.log(chalk.yellow('Opening browser to authenticate with Spotify...'));
  await open(authURL);

  return new Promise((resolve, reject) => {
    const app = express();
    const server = app.listen(3000, () => {
      console.log(chalk.yellow('Waiting on http://localhost:3000...'));
    });

    app.get('/callback', async (req, res) => {
      const code = req.query.code;
      if (!code) {
        res.status(400).send('Missing authorization code.');
        return reject(new Error('No code in callback'));
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

        const { access_token, refresh_token } = tokenRes.data;

        tokens.access = access_token;
        tokens.refresh = refresh_token;
        saveTokensToFile(tokens);

        console.log(chalk.green('\n✅ Logged in successfully!'));
        res.send('✅ Login complete! You may close this window.');

        // Gracefully close server and return control to CLI
        setTimeout(() => {
          server.close(() => {
            resolve();  // 👈 CLI continues here
          });
        }, 1000);

      } catch (err) {
        res.status(500).send('❌ Token exchange failed.');
        reject(err);
      }
    });
  });
}

// =============================
// USER'S TOP SONGS
// =============================

async function handleUserTopSongs(limit, time_range) {
  const tokens = loadTokensFromFile();
  const access = tokens.access;

  let time;
  if (time_range === "short") {
    time = "short_term";
  } else if (time_range === "medium") {
    time = "medium_term";
  } else if (time_range === "long") {
    time = "long_term";
  } else {
    console.log(chalk.red("Invalid time input! Use short, medium, or long."));
    return;
  }

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/me/top/tracks?time_range=${time}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${access}`
        }
      }
    );

    console.log(chalk.underline("🎵 Top Tracks:"));
    response.data.items.forEach((track, index) => {
      console.log(chalk.bold(`${index + 1}. ${track.name} — ${track.artists.map(a => a.name).join(", ")}`));
    });
    console.log("\n");

  } catch (err) {
    console.error("Error fetching top tracks:", err.response?.data || err.message);
  }
}

// ==============================
// USER'S TOP ARTIST
// ==============================

async function handleUserTopArtists(limit, time_range) {
  const tokens = loadTokensFromFile();
  const access = tokens.access;
  let time;
  if (time_range === "short") {
    time = "short_term";
  } else if (time_range === "medium") {
    time = "medium_term";
  } else if (time_range === "long") {
    time = "long_term";
  } else {
    console.log(chalk.red("Invalid time input! Use short, medium, or long."));
    return;
  }
}



// ==============================
// YARGS CLI SETUP
// ==============================
// yargs(hideBin(process.argv))
//   .command('login', 'Authenticate with Spotify via PKCE', {}, handleLoginCommand)
//   .command(
//     'top-tracks',
//     'View your top Spotify tracks',
//     yargs => {
//       return yargs
//         .option('limit', {
//           alias: 'l',
//           type: 'number',
//           default: 10,
//           describe: 'Number of tracks to show (1–50)'
//         })
//         .option('range', {
//           alias: 'r',
//           type: 'string',
//           choices: ['short', 'medium', 'long'],
//           default: 'medium',
//           describe: 'Time range: short (4 weeks), medium (6 months), or long (years)'
//         });
//     },
//     argv => handleUserTopSongs(argv.limit, argv.range)
//   )
//   .strict()
//   .help()
//   .argv;


async function SpotifyCliLoop() {
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '🎧 What would you like to do?',
        choices: [
          { name: 'View Top Tracks', value: 'top-tracks' },
          { name: 'Login to Spotify', value: 'login' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);

    if (action === 'exit') {
      const thankYouMessage = chalk.green('Thank you for using Spotify CLI Tool');
      const boxed = boxen(thankYouMessage, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'magenta',
        align: 'center'
      });
      console.log(boxed);
      process.exit(0);
    }

    if (action === 'login') {
      await handleLoginCommand();
    }

    if (action === 'top-tracks') {
      const { limit, range } = await inquirer.prompt([
        {
          type: 'number',
          name: 'limit',
          message: 'How many tracks?',
          default: 10
        },
        {
          type: 'list',
          name: 'range',
          message: 'Time range?',
          choices: [
            { name: 'Short (4 weeks)', value: 'short' },
            { name: 'Medium (6 months)', value: 'medium' },
            { name: 'Long (years)', value: 'long' }
          ]
        }
      ]);
      await handleUserTopSongs(limit, range);
    }
  }
}

SpotifyCliLoop();