<?php
// Voorbeeld. De deploy-workflow schrijft config.php met de echte waarden uit de GitHub-secrets.
// Handmatig instellen kan ook: kopieer naar config.php en vul in. config.php nooit in git zetten.
return [
    'client_id' => 'GitHub OAuth App: Client ID',
    'client_secret' => 'GitHub OAuth App: Client secret',
    // Optioneel, standaard dit script zelf: 'redirect_uri' => 'https://www.badminton-pbo.be/admin/auth/',
    // Optioneel: andere sites waar /admin mag inloggen, naast www.badminton-pbo.be en de testversie op GitHub Pages.
    // De deploy zet hier zelf het testsubdomein uit SITE_URL: 'origins' => ['https://nieuw.badminton-pbo.be'],
];
