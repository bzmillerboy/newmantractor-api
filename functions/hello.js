// hello there!
//
// I'm a serverless function that you can deploy as part of your site.
// I'll get deployed to AWS Lambda, but you don't need to know that.
// You can develop and deploy serverless functions right here as part
// of your site. Netlify Functions will handle the rest for you.

exports.handler = async (event) => {
  const subject = event.queryStringParameters.name || "World";
  return {
    statusCode: 200,
    body: `Hello ${subject}!`,
    headers: {
      "access-control-allow-origin": "https://newmantractorcom.gatsbyjs.io/", // your CORS config here
      "cache-control": "public, max-age=0, must-revalidate",
    },
  };
};
