const {
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME,
  PORTAL_URL,
  SUPABASE_URL,
  SUPABASE_KEY_SERVICE_KEY,
} = process.env;
const sgMail = require("@sendgrid/mail");

const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = SUPABASE_URL;
const supabaseKey = SUPABASE_KEY_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const createFinanceApplication = async (data) => {
  // console.log("createFinanceApplication props", data);
  const { referring_url, type } = data;
  const applicationsRes = await supabase
    .from("applications")
    .insert({
      contact_id: data.contactId,
      status_id: 1,
      referring_url: referring_url,
      type_id: type,
    })
    .select()
    .single();

  if (applicationsRes.error) {
    console.log("create applications error", applicationsRes.error);
  }

  if (applicationsRes.data) {
    return applicationsRes.data;
  }
};

const sendFinanceApplicationEmail = async (data) => {
  sgMail.setApiKey(SENDGRID_API_KEY);
  const { user, application, existingUser } = data;
  const { action_link, hashed_token, redirect_to } = user.properties;
  const { id, email } = user.user;
  const { first_name, last_name, phone } = user.user.user_metadata;
  const { id: applicationId } = application;

  const link =
    `${PORTAL_URL}/applications/start?confirmationUrl=` +
    encodeURIComponent(
      `${supabaseUrl}/auth/v1/verify?token=${hashed_token}&type=${
        existingUser ? "magiclink" : "signup"
      }&redirect_to=${PORTAL_URL}/applications/create/${applicationId}`
    );

  const msg = {
    to: email,
    from: {
      email: SENDGRID_FROM_EMAIL,
      name: SENDGRID_FROM_NAME,
    },
    replyTo: "financing@newmantractor.com", //TODO: update to reflect Matt or Caroll depending on type
    subject: `Complete Your Financing Application | Ref #${
      application.application_id || ""
    } | | Newman Tractor`,
    templateId: "d-872664c1622349a081ab390bdffbfce3",
    dynamic_template_data: {
      email: email,
      link: link,
      firstName: first_name,
      lastName: last_name,
      application_id: application?.application_id || "",
    },
  };

  console.log("msg", msg);

  const sgMailRes = await sgMail.send(msg);
  return "email sent";
};

const createFinanceApplicationActivity = async (appId, userId) => {
  // console.log("createFinanceApplication props", data);
  const applicationActivityRes = await supabase
    .from("application_activity")
    .insert({
      name: "application initiated",
      application_id: appId,
      created_by: userId,
    })
    .select()
    .single();

  if (applicationActivityRes.error) {
    console.log("create applications error", applicationActivityRes.error);
  }

  if (applicationActivityRes.data) {
    return applicationActivityRes.data;
  }
};

module.exports = {
  createFinanceApplication,
  sendFinanceApplicationEmail,
  createFinanceApplicationActivity,
};
