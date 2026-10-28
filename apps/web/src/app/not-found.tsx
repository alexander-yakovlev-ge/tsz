// Запасная 404 для адресов вне языковых префиксов (обычно middleware добавляет префикс сам).
export default function GlobalNotFound() {
  return (
    <html lang="ka">
      <body
        style={{ fontFamily: 'system-ui, sans-serif', padding: '48px 16px', textAlign: 'center' }}
      >
        <h1>404</h1>
        <p>
          <a href="/">თამარ მეფის 1</a>
        </p>
      </body>
    </html>
  );
}
