const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event) => {
  // console.log("event:", JSON.stringify(event));

  // const {} = await supabase.auth.admin.deleteUser(
  //   "2b9786b2-e163-4e97-a9d5-64ed27d8b18e"
  // );

  // const {
  //   data: { users },
  //   error,
  // } = await supabase.auth.admin.listUsers({
  //   page: 1,
  //   perPage: 1000,
  // });

  // if (error) {
  //   console.log("error:", error);
  //   return { statusCode: 500, body: JSON.stringify(error) };
  // }

  return { statusCode: 200 };
};
