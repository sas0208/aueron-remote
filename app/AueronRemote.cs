using System;
using System.IO;
using System.Drawing;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class Program {
    internal static string NormalizeHub(string input) {
        Uri uri;
        if (!Uri.TryCreate(input.Trim(), UriKind.Absolute, out uri) || uri.Scheme != "https" ||
            !String.IsNullOrEmpty(uri.UserInfo) || !String.IsNullOrEmpty(uri.Query) || !String.IsNullOrEmpty(uri.Fragment) ||
            (uri.AbsolutePath != "/" && uri.AbsolutePath != ""))
            throw new ArgumentException("Inserisci solo l'indirizzo HTTPS del centro, senza password, parametri o percorsi.");
        return uri.GetLeftPart(UriPartial.Authority) + "/";
    }

    [STAThread]
    private static int Main(string[] args) {
        if (args.Length > 0 && args[0] == "--self-test") {
            if (NormalizeHub("https://pc.tail-example.ts.net") != "https://pc.tail-example.ts.net/") return 1;
            foreach (var bad in new [] {"http://example.com", "javascript:alert(1)", "https://user:pass@example.com", "https://example.com/?secret=a", "https://example.com/path", "https://example.com/#x"}) {
                try { NormalizeHub(bad); return 2; } catch (ArgumentException) { }
            }
            return 0;
        }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        using (var form = new HubForm()) {
            if (args.Length == 2 && args[0] == "--render-preview") {
                form.Opacity = 0;
                form.ShowInTaskbar = false;
                form.Show();
                Application.DoEvents();
                using (var bitmap = new Bitmap(form.Width, form.Height)) {
                    form.DrawToBitmap(bitmap, new Rectangle(0, 0, form.Width, form.Height));
                    bitmap.Save(args[1]);
                }
                return 0;
            }
            Application.Run(form);
        }
        return 0;
    }
}

internal sealed class HubForm : Form {
    private readonly TextBox address = new TextBox();
    private readonly Label status = new Label();
    private readonly string root = AppDomain.CurrentDomain.BaseDirectory;
    private readonly string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AueronRemote", "hub.txt");
    private readonly Color navy = Color.FromArgb(23, 36, 60);
    private readonly Color teal = Color.FromArgb(75, 95, 218);

    internal HubForm() {
        Text = "Aueron Remote";
        ClientSize = new Size(860, 560);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        Font = new Font("Segoe UI", 10);
        BackColor = Color.FromArgb(247, 249, 252);
        DoubleBuffered = true;
        var sidebar = new Panel { BackColor = Color.FromArgb(16, 26, 44) };
        sidebar.SetBounds(0, 0, 274, 560); Controls.Add(sidebar);
        sidebar.Paint += delegate(object sender, PaintEventArgs e) {
            e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            using (var fill = new SolidBrush(teal)) e.Graphics.FillEllipse(fill, 32, 34, 42, 42);
            using (var line = new Pen(Color.White, 2)) {
                e.Graphics.DrawLines(line, new [] { new Point(42,62), new Point(53,44), new Point(64,62) });
                e.Graphics.DrawLine(line, 47,56,59,56);
            }
            using (var muted = new Pen(Color.FromArgb(70, 88, 126), 1)) {
                e.Graphics.DrawRectangle(muted, 34, 388, 78, 50);
                e.Graphics.DrawLine(muted, 73,438,73,449); e.Graphics.DrawLine(muted, 58,449,88,449);
                e.Graphics.DrawRectangle(muted, 196, 382, 31, 65);
                e.Graphics.DrawLine(muted, 121,413,185,413);
            }
        };
        SideLabel(sidebar, "aueron", 86, 29, 156, 35, 23, Color.White);
        SideLabel(sidebar, "R E M O T E", 88, 64, 150, 20, 8, Color.FromArgb(170,182,206));
        SideLabel(sidebar, "Tutti i tuoi PC.\nUn solo posto.", 32, 150, 230, 108, 21, Color.FromArgb(232,237,250));
        SideLabel(sidebar, "Desktop, terminale e file.\nDal PC o dal telefono.", 34, 272, 216, 60, 11, Color.FromArgb(185,197,218));
        SideLabel(sidebar, "IL TUO CENTRO PERSONALE", 34, 509, 220, 22, 8, Color.FromArgb(170,182,206));
        var eyebrow = LabelAt("CENTRO DI COMANDO", 316, 43, 495, 22);
        eyebrow.Font = new Font("Segoe UI", 8, FontStyle.Bold); eyebrow.ForeColor = Color.FromArgb(96,112,136);
        var title = LabelAt("Riprendi il controllo.", 312, 84, 505, 49);
        title.Font = new Font("Segoe UI", 25, FontStyle.Bold);
        var intro = LabelAt("Apri il tuo spazio per gestire i computer collegati.", 316, 143, 500, 28);
        intro.ForeColor = Color.FromArgb(96,112,136);
        var addressLabel = LabelAt("Indirizzo del centro", 316, 204, 490, 24);
        addressLabel.Font = new Font("Segoe UI", 10, FontStyle.Bold);
        var inputFrame = new Panel { BackColor = Color.White, Padding = new Padding(12, 10, 12, 10), BorderStyle = BorderStyle.FixedSingle };
        inputFrame.SetBounds(316, 237, 498, 47); Controls.Add(inputFrame);
        address.Dock = DockStyle.Fill;
        address.BorderStyle = BorderStyle.None;
        address.Font = new Font("Segoe UI", 11);
        address.BackColor = Color.White; address.ForeColor = navy;
        address.AccessibleName = "Indirizzo HTTPS del centro Aueron";
        address.Text = "https://localhost:8943/";
        if (File.Exists(profile)) {
            try { address.Text = Program.NormalizeHub(File.ReadAllText(profile)); }
            catch { }
        }
        inputFrame.Controls.Add(address);
        var open = ButtonAt("Apri centro   >", 316, 308, 498, true);
        open.Click += delegate { OpenHub(); };
        var local = ButtonAt("Avvia centro locale", 316, 367, 322, false);
        local.Click += async delegate { await StartLocal(local); };
        var guide = ButtonAt("Guida", 650, 367, 164, false);
        guide.Click += delegate {
            try { Process.Start(new ProcessStartInfo("notepad.exe", Quote(Path.Combine(root, "README_IT.md"))) { UseShellExecute = true }); }
            catch (Exception ex) { ShowError(ex.Message); }
        };
        status.SetBounds(316, 431, 498, 60);
        status.Font = new Font("Segoe UI", 9);
        status.ForeColor = Color.FromArgb(96, 112, 136);
        status.Text = "Il centro si apre nel browser.\nPer avviarlo su questo PC usa \"Avvia centro locale\".";
        Controls.Add(status);
        var footer = LabelAt("Aueron 0.2  /  Powered by MeshCentral", 316, 517, 498, 20);
        footer.Font = new Font("Segoe UI", 8);
        footer.ForeColor = Color.FromArgb(100, 114, 128);
        AcceptButton = open;
        address.TabIndex = 0; open.TabIndex = 1; local.TabIndex = 2; guide.TabIndex = 3;
    }
    private static void SideLabel(Panel parent, string text, int x, int y, int w, int h, float size, Color color) {
        var label = new Label { Text = text, ForeColor = color, Font = new Font("Segoe UI", size), BackColor = Color.Transparent };
        label.SetBounds(x,y,w,h); parent.Controls.Add(label);
    }
    private Label LabelAt(string text, int x, int y, int w, int h) {
        var label = new Label { Text = text, ForeColor = navy, AutoSize = false };
        label.SetBounds(x, y, w, h); Controls.Add(label); return label;
    }
    private Button ButtonAt(string text, int x, int y, int w, bool primary) {
        var b = new Button { Text = text, FlatStyle = FlatStyle.Flat, BackColor = primary ? teal : Color.White, ForeColor = primary ? Color.White : navy, Cursor = Cursors.Hand };
        b.FlatAppearance.BorderColor = primary ? teal : Color.FromArgb(208, 217, 225);
        b.Font = new Font("Segoe UI", 10, FontStyle.Bold);
        b.FlatAppearance.MouseOverBackColor = primary ? Color.FromArgb(57,74,185) : Color.FromArgb(235,239,249);
        b.SetBounds(x,y,w,46); Controls.Add(b); return b;
    }
    private static string Quote(string value) { return "\"" + value.Replace("\"", "") + "\""; }
    private void ShowError(string text) { status.Text = text; status.ForeColor = Color.FromArgb(160, 35, 35); }
    private void OpenHub() {
        try {
            var url = Program.NormalizeHub(address.Text);
            Directory.CreateDirectory(Path.GetDirectoryName(profile));
            File.WriteAllText(profile, url);
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            status.Text = "Centro aperto nel browser. L'accesso e le sessioni restano gestiti dal centro.";
            status.ForeColor = teal;
        } catch (Exception ex) { ShowError(ex.Message); }
    }
    private async Task StartLocal(Button button) {
        button.Enabled = false;
        status.Text = "Avvio del centro locale in corso...";
        try {
            var script = Path.Combine(root, "Avvia-Centro.ps1");
            if (!File.Exists(script)) throw new IOException("Questo e il solo client. Per ospitare il centro serve il pacchetto completo.");
            var info = new ProcessStartInfo("powershell.exe", "-NoProfile -ExecutionPolicy Bypass -File " + Quote(script) + " -NoBrowser") {
                UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = root
            };
            using (var process = Process.Start(info)) {
                await Task.Run(() => process.WaitForExit());
                if (process.ExitCode != 0) throw new IOException("Il centro non e partito. Controlla i log nella cartella runtime/launcher-logs.");
                address.Text = Program.NormalizeHub(File.ReadAllText(Path.Combine(root, "runtime", "launcher-url.txt")));
                OpenHub();
            }
        } catch (Exception ex) { ShowError(ex.Message); }
        finally { button.Enabled = true; }
    }
}
