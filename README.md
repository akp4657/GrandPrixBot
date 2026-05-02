# GrandPrixBot

Discord bot to automate callouts and keep records of wins

# TODOs

- Implement notifications after the Date/Time has been passed. Mark all open matches as complete (ties) before notifying. (Likely cron job)
- On winner selection, assign the Champion and Runner-Up roles while removing the role from the previous user. If it's the same user, don't do anything
- Have a new txt DB with relevant posts/links.
  - The posts can be configured with a slash command like /posts (Admin only)
  - X posts will be posted once a week (if configured) unless there's a free X workaround
  - Google Form signups will be posted on the 1st, 15th, and last day of the month
  - /posts will have the following fields:
    - X link(s), Google Form, Google Form Message (1st), Google Form Message (15th), Google Form Message (Last Day)
