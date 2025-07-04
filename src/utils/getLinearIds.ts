import { LinearClient } from '@linear/sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function getLinearIds() {
  const apiKey = process.env.LINEAR_API_KEY;
  
  if (!apiKey) {
    console.error('❌ LINEAR_API_KEY not found in .env file');
    process.exit(1);
  }

  console.log('🔍 Fetching Linear workspace information...\n');

  const client = new LinearClient({ apiKey });

  try {
    // 1. Get all teams
    console.log('📋 TEAMS:');
    console.log('=========');
    const teams = await client.teams();
    for (const team of teams.nodes) {
      console.log(`Team Name: ${team.name}`);
      console.log(`Team ID: ${team.id}`);
      console.log(`Team Key: ${team.key}`);
      console.log('---------');
    }

    // 2. Get all projects
    console.log('\n📁 PROJECTS:');
    console.log('============');
    const projects = await client.projects();
    for (const project of projects.nodes) {
      console.log(`Project Name: ${project.name}`);
      console.log(`Project ID: ${project.id}`);
      console.log(`Project State: ${project.state}`);
      
      // Get team info for this project
      const projectTeams = await project.teams();
      if (projectTeams.nodes.length > 0) {
        console.log(`Associated Team: ${projectTeams.nodes[0].name}`);
      }
      console.log('---------');
    }

    // 3. Get all users (to find Regina)
    console.log('\n👥 USERS:');
    console.log('=========');
    const users = await client.users();
    for (const user of users.nodes) {
      // Look for Regina specifically
      if (user.name?.toLowerCase().includes('regina') || 
          user.displayName?.toLowerCase().includes('regina') ||
          user.email?.toLowerCase().includes('regina')) {
        console.log(`⭐ POTENTIAL MATCH FOR REGINA:`);
      }
      
      console.log(`Name: ${user.name}`);
      console.log(`Display Name: ${user.displayName}`);
      console.log(`User ID: ${user.id}`);
      console.log(`Email: ${user.email || 'N/A'}`);
      console.log(`Active: ${user.active}`);
      console.log('---------');
    }

    // 4. Get labels (for reference)
    console.log('\n🏷️  LABELS:');
    console.log('==========');
    const workspaceLabels = await client.issueLabels();
    for (const label of workspaceLabels.nodes) {
      console.log(`Label Name: ${label.name}`);
      console.log(`Label ID: ${label.id}`);
      console.log(`Label Color: ${label.color}`);
      console.log('---------');
    }

    console.log('\n✅ Done! Please update your .env file with the appropriate IDs:');
    console.log('LINEAR_TEAM_ID=<team_id_from_above>');
    console.log('LINEAR_PROJECT_ID=<project_id_for_"Request_Tickets">');
    console.log('LINEAR_REGINA_USER_ID=<regina_user_id_from_above>');

  } catch (error) {
    console.error('❌ Error fetching Linear data:', error);
    console.error('\nMake sure your LINEAR_API_KEY has the necessary permissions:');
    console.error('- Read access to teams');
    console.error('- Read access to projects');
    console.error('- Read access to users');
  }
}

// Run the script
getLinearIds().catch(console.error);