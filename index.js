const axios = require('axios');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const schedule = require('node-schedule');

const url =
  'https://github.com/Ouckah/Summer2025-Internships?tab=readme-ov-file';
const webhookUrl = 'https://your-webhook-url.com';

let latestJobListings = [];

async function scrapeJobListings() {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const jobListings = [];

    $('table tbody tr').each((index, element) => {
      const company = $(element).find('td').eq(0).text().trim();
      const role = $(element).find('td').eq(1).text().trim();
      const location = $(element).find('td').eq(2).text().trim();
      const applicationLink = $(element)
        .find('td')
        .eq(3)
        .find('a')
        .attr('href');
      const datePosted = $(element).find('td').eq(4).text().trim();

      jobListings.push({
        company,
        role,
        location,
        applicationLink,
        datePosted,
      });
    });

    // Sort job listings by datePosted
    jobListings.sort((a, b) => {
      const dateA = new Date(`2024 ${a.datePosted}`);
      const dateB = new Date(`2024 ${b.datePosted}`);
      return dateB - dateA;
    });

    return jobListings;
  } catch (error) {
    console.error('Error fetching job listings:', error);
  }
}

async function checkForNewJobListings() {
  const jobListings = await scrapeJobListings();
  if (!jobListings) return;

  const newJobListings = jobListings.slice(0, 5);

  if (latestJobListings.length === 0) {
    latestJobListings = newJobListings;
    return;
  }

  const newJobs = newJobListings.filter(
    (job) =>
      !latestJobListings.some(
        (existingJob) =>
          existingJob.company === job.company &&
          existingJob.role === job.role &&
          existingJob.location === job.location &&
          existingJob.datePosted === job.datePosted
      )
  );

  if (newJobs.length > 0) {
    latestJobListings = newJobListings;
    for (const job of newJobs) {
      await sendWebhookNotification(job);
    }
  }
}

async function sendWebhookNotification(job) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `New Job Detected!\nCompany: ${job.company}\nRole: ${job.role}\nLocation: ${job.location}\nDate Posted: ${job.datePosted}\nApplication Link: ${job.applicationLink}`,
      }),
    });
  } catch (error) {
    console.error('Error sending webhook:', error);
  }
}

// Schedule the job to run every 5 minutes
schedule.scheduleJob('*/1 * * * *', checkForNewJobListings);

// Initial check
checkForNewJobListings();
