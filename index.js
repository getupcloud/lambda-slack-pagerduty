const url = require('url')
const https = require('https')
var urls = process.env.URLS.split(' ')
const slack_url = process.env.SLACK_URL
const pager_url = "https://events.pagerduty.com/generic/2010-04-15/create_event.json"
        

const request = (options, params) => {
  return new Promise((resolve, reject) => {
    const req = https.request(options, function (res) {
      return resolve({statusCode: res.statusCode})
    })

    req.on('error', function(error) {
      console.log('problem with request: ' + error.message);
      return reject(error)
    });
    
    if (params) {
      req.write(JSON.stringify(params));
    }
    
    req.end();
  })
}

const handler = async (event) => {
  let completed = 0
  let errors = 0

  const records = event.Records || []

   for (const rec of records) {
    if (rec.Sns) {

      const {
        Subject,
        Type
      } = JSON.parse(rec.Sns.Message)

      let i
      for (i in urls) {
        try {
          const ping = await request(urls[i])
          const {statusCode} = ping  

          completed += 1

          if (statusCode === 403 || statusCode === 200 ) {
            console.log(`Not posted to slack: ${statusCode}`)
          } else {
            console.log(`Posted to slack: ${statusCode}`)

            const params = {
              
              attachments: [{
                color: '#cc0000',
                author_name: `Prometheus`,
                author_icon: 'http://icons.iconarchive.com/icons/paomedia/small-n-flat/256/sign-error-icon.png',
                text: urls[i],
                title: 'Prometheus-Down',
                fields: [{
                    text: 'Cluster',
                    text: urls[i],
                    short: false
                }]
              }]
            }

            const options = {
              ...url.parse(slack_url),
              method: 'POST',
              headers: {'Content-Type': 'application/json'}
            }

            const postToSlack = await request(options, params)
            console.log(`Posted to Slack: ${postToSlack.statusCode}`)


            const op = {
              ...url.parse(pager_url),
              method: 'POST',
              headers: {"Content-type": "application/json"}

            }

            const payload = {
              "service_key": process.env.PAGER_KEY, 
              "incident_key": "srv01/HTTP",
              "event_type": "trigger",
              "description": " Prometheus OutOfService " + urls[i], 
              "client": "Monitoring Service",
              "client_url": urls[i],
              "details": {
      
                "Problema": 'Prometheus Down '+ urls[i],
              }
            }

            const postToPagerDuty = await request(op, payload )
          }
        } catch(error) {
          errors += 1
        }
      }
    
      console.log(`Processed messages: ${i}`)
    } else {
      console.error('No messages in SNS')
    }
  };

  console.log(JSON.stringify({completed, errors}, null, 2))
  return {completed, errors}
}

module.exports = {
  handler
}
