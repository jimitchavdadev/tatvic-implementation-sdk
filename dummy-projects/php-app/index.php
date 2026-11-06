<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PHP + GTM First-Party Wrapper Demo</title>
  <!-- 1. Load the Tatvic standalone script -->
  <script src="/dist/tatvic.js"></script>
</head>
<body>
  <!-- 2. The Simple Wrapper around the PHP app -->
  <tatvic-wrapper endpoint="/tatvic-proxy.php">
    <header>
      <h1><?php echo "PHP / WordPress App + GTM Integration"; ?></h1>
      <p>GTM Container: <strong>GTM-T32XGF8F</strong></p>
    </header>

    <main>
      <!-- User GTM Snippet -->
      <script async src="https://www.googletagmanager.com/gtm.js?id=GTM-T32XGF8F"></script>
      <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
      </script>

      <div style="margin: 20px 0;">
        <button id="buy-btn" style="padding: 10px 20px; font-size: 16px;">Trigger Generate Lead</button>
      </div>

      <div id="result" style="font-weight: bold; color: green;"></div>
    </main>

    <script>
      document.getElementById('buy-btn').addEventListener('click', function() {
        gtag('event', 'generate_lead', {
          value: 79.50,
          currency: 'USD'
        });

        // Telemetry collect call to sGTM container
        fetch('https://tpozgxiu.usu.stape.io/g/collect?v=2&tid=G-TEST&en=generate_lead', {
          method: 'POST',
          body: 'en=generate_lead&value=79.50'
        }).then(function(res) {
          document.getElementById('result').innerText = 'PHP telemetry relayed to sGTM! Status: ' + res.status;
        }).catch(function(err) {
          document.getElementById('result').innerText = 'Error: ' + err.message;
        });
      });
    </script>
  </tatvic-wrapper>
</body>
</html>
