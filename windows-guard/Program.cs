/*
╭────────────────────────────────────────────────────────────────────╮
│  JTG - JELOFEN'S TAB GUARDIAN                                      │
│  Crafted by : Jelofen The Dev                                     │
│  Telegram   : https://t.me/Jelofen1962                            │
│  Contact    : +989035361164                                       │
│                                                                    │
│  Windows companion: intercepts tab-strip close-button clicks      │
│  using Windows UI Automation + a low-level mouse hook.             │
╰────────────────────────────────────────────────────────────────────╯
*/

using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Automation;
using System.Windows.Forms;

namespace JTG.TabCloseGuard;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new GuardApplicationContext());
    }
}

internal sealed class GuardApplicationContext : ApplicationContext
{
    private readonly Control _dispatcher = new();
    private readonly NotifyIcon _tray;
    private readonly ToolStripMenuItem _enabledItem;
    private readonly System.Windows.Forms.Timer _scanTimer;
    private readonly MouseHook _mouseHook;
    private readonly KeyboardHook _keyboardHook;
    private readonly object _rectLock = new();
    private List<TabHitTarget> _targets = new();
    private int _scanBusy;
    private int _promptBusy;
    private volatile bool _enabled = true;
    private string _lastScanSummary = string.Empty;

    public GuardApplicationContext()
    {
        _ = _dispatcher.Handle;

        var menu = new ContextMenuStrip();
        _enabledItem = new ToolStripMenuItem("Protect tab close buttons", null, (_, _) => ToggleEnabled())
        {
            Checked = true,
            CheckOnClick = false
        };
        menu.Items.Add(_enabledItem);
        menu.Items.Add(new ToolStripMenuItem("Open diagnostic log", null, (_, _) => OpenLog()));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(new ToolStripMenuItem("Exit JTG Tab Guard", null, (_, _) => ExitThread()));

        _tray = new NotifyIcon
        {
            Icon = SystemIcons.Shield,
            Text = "JTG Tab Guardian | Windows close guard",
            ContextMenuStrip = menu,
            Visible = true
        };
        _tray.DoubleClick += (_, _) => ShowStatus();

        _mouseHook = new MouseHook(OnMouseDown);
        _mouseHook.Install();
        _keyboardHook = new KeyboardHook(OnShortcut);
        _keyboardHook.Install();

        _scanTimer = new System.Windows.Forms.Timer { Interval = 650 };
        _scanTimer.Tick += (_, _) => StartScan();
        _scanTimer.Start();
        StartScan();

        Log("JTG Windows companion started. Watching locked Chrome and Edge tabs (🔒 title marker required).");
        _tray.ShowBalloonTip(2500, "JTG Tab Guardian", "Close confirmation is active for detected locked tabs.", ToolTipIcon.Info);
    }

    private void ToggleEnabled()
    {
        _enabled = !_enabled;
        _enabledItem.Checked = _enabled;
        _tray.Text = _enabled
            ? "JTG Tab Guardian | Protection ON"
            : "JTG Tab Guardian | Protection OFF";
        Log($"Protection {(_enabled ? "enabled" : "disabled")}.");
    }

    private void ShowStatus()
    {
        int count;
        lock (_rectLock) count = _targets.Count;
        MessageBox.Show(
            $"JTG Windows Tab Guard\n\nProtection: {(_enabled ? "ON" : "OFF")}\nDetected tab targets: {count}\n\nThis helper watches close controls for tabs marked with 🔒 while it is running.",
            "JTG - Jelofen's Tab Guardian",
            MessageBoxButtons.OK,
            MessageBoxIcon.Information);
    }

    private void OpenLog()
    {
        try
        {
            var path = GetLogPath();
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            if (!File.Exists(path)) File.WriteAllText(path, "JTG diagnostic log" + Environment.NewLine);
            Process.Start(new ProcessStartInfo(path) { UseShellExecute = true });
        }
        catch (Exception ex) { Log("Could not open log: " + ex.Message); }
    }

    private void StartScan()
    {
        if (Interlocked.Exchange(ref _scanBusy, 1) != 0) return;
        _ = Task.Run(() =>
        {
            try
            {
                var next = BrowserUiScanner.Scan();
                lock (_rectLock) _targets = next;
                var summary = $"Found {next.Count} tab close target(s).";
                if (!String.Equals(summary, _lastScanSummary, StringComparison.Ordinal))
                {
                    _lastScanSummary = summary;
                    Log(summary);
                }
            }
            catch (Exception ex) { Log("UI Automation scan failed: " + ex); }
            finally { Interlocked.Exchange(ref _scanBusy, 0); }
        });
    }

    private bool OnMouseDown(MousePoint point, MouseButtonKind button)
    {
        if (!_enabled) return false;

        TabHitTarget? match = null;
        lock (_rectLock)
        {
            foreach (var target in _targets)
            {
                bool hit = button == MouseButtonKind.Left
                    ? target.CloseButton.Contains(point.X, point.Y)
                    : target.TabBounds.Contains(point.X, point.Y);
                if (hit) { match = target; break; }
            }
        }
        if (match is null) return false;
        // While a confirmation is open, swallow additional close-button clicks too.
        if (Volatile.Read(ref _promptBusy) != 0) return true;
        if (Interlocked.CompareExchange(ref _promptBusy, 1, 0) != 0) return true;

        try
        {
            _dispatcher.BeginInvoke(new Action(() => AskAndReplay(point, button)));
        }
        catch
        {
            Interlocked.Exchange(ref _promptBusy, 0);
            return false;
        }
        return true; // swallow the original browser-UI click until the user decides
    }

    private void AskAndReplay(MousePoint point, MouseButtonKind button)
    {
        try
        {
            using var dialog = new CloseConfirmDialog(
                "Close this browser tab?",
                "The tab will close only after you confirm.");
            var answer = dialog.ShowDialog();
            if (answer == DialogResult.Yes)
            {
                // Replay the exact click after approval, so a background tab stays the target.
                MouseHook.ReplayClick(point, button);
                Log($"User confirmed tab close at screen position {point.X},{point.Y}.");
            }
            else Log("User kept the tab open.");
        }
        catch (Exception ex) { Log("Confirmation dialog failed: " + ex); }
        finally { Interlocked.Exchange(ref _promptBusy, 0); }
    }

    private bool OnShortcut(BrowserShortcut shortcut)
    {
        if (!_enabled || !BrowserUiScanner.IsBrowserForegroundWindow() || !IsShortcutForLockedTab(shortcut)) return false;
        if (Volatile.Read(ref _promptBusy) != 0) return true;
        if (Interlocked.CompareExchange(ref _promptBusy, 1, 0) != 0) return true;
        try
        {
            _dispatcher.BeginInvoke(new Action(() => AskAndReplayShortcut(shortcut)));
            return true;
        }
        catch
        {
            Interlocked.Exchange(ref _promptBusy, 0);
            return false;
        }
    }

    private bool IsShortcutForLockedTab(BrowserShortcut shortcut)
    {
        var foreground = NativeMethods.GetForegroundWindow();
        if (foreground == IntPtr.Zero) return false;
        bool closesWholeWindow = shortcut is BrowserShortcut.CtrlShiftW or BrowserShortcut.AltF4;
        lock (_rectLock)
        {
            return _targets.Any(target => target.WindowHandle == foreground &&
                (closesWholeWindow || target.IsSelected));
        }
    }

    private void AskAndReplayShortcut(BrowserShortcut shortcut)
    {
        bool closesWindow = shortcut is BrowserShortcut.CtrlShiftW or BrowserShortcut.AltF4;
        try
        {
            using var dialog = new CloseConfirmDialog(
                closesWindow ? "Close this browser window?" : "Close this browser tab?",
                closesWindow ? "All tabs in this window may be closed." : "The tab will close only after you confirm.");
            if (dialog.ShowDialog() == DialogResult.Yes)
            {
                KeyboardHook.ReplayShortcut(shortcut);
                Log($"User confirmed keyboard close action: {shortcut}.");
            }
            else Log($"User cancelled keyboard close action: {shortcut}.");
        }
        catch (Exception ex) { Log("Keyboard confirmation failed: " + ex); }
        finally { Interlocked.Exchange(ref _promptBusy, 0); }
    }

    protected override void ExitThreadCore()
    {
        _scanTimer.Stop();
        _scanTimer.Dispose();
        _mouseHook.Dispose();
        _keyboardHook.Dispose();
        _tray.Visible = false;
        _tray.Dispose();
        _dispatcher.Dispose();
        Log("JTG Windows companion stopped.");
        base.ExitThreadCore();
    }

    internal static string GetLogPath() => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "JTG", "TabCloseGuard.log");

    internal static void Log(string message)
    {
        try
        {
            var path = GetLogPath();
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.AppendAllText(path, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}] {message}{Environment.NewLine}");
        }
        catch { /* logging must never interrupt mouse input */ }
    }
}

internal sealed class CloseConfirmDialog : Form
{
    public CloseConfirmDialog(string headingText, string detailText)
    {
        Text = "JTG - Confirm close";
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MinimizeBox = false;
        MaximizeBox = false;
        ShowInTaskbar = false;
        TopMost = true;
        BackColor = Color.White;
        ForeColor = Color.Black;
        ClientSize = new Size(370, 158);
        Font = new Font("Segoe UI", 9F, FontStyle.Regular);

        var heading = new Label
        {
            Text = headingText,
            Font = new Font("Segoe UI Semibold", 13F, FontStyle.Bold),
            AutoSize = false,
            TextAlign = ContentAlignment.MiddleCenter,
            Bounds = new Rectangle(16, 16, 338, 34)
        };
        var detail = new Label
        {
            Text = detailText,
            AutoSize = false,
            TextAlign = ContentAlignment.MiddleCenter,
            Bounds = new Rectangle(16, 52, 338, 24),
            ForeColor = Color.FromArgb(85, 85, 85)
        };
        var stay = new Button
        {
            Text = "Stay",
            DialogResult = DialogResult.No,
            Bounds = new Rectangle(83, 100, 92, 34),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.White,
            ForeColor = Color.Black
        };
        var close = new Button
        {
            Text = "Close",
            DialogResult = DialogResult.Yes,
            Bounds = new Rectangle(195, 100, 92, 34),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.Black,
            ForeColor = Color.White
        };
        Controls.AddRange(new Control[] { heading, detail, stay, close });
        CancelButton = stay; // safest default: Escape keeps the tab open
        AcceptButton = stay; // Enter also defaults to Stay
    }
}

internal sealed record TabHitTarget(IntPtr WindowHandle, Rectangle TabBounds, Rectangle CloseButton, bool IsSelected);
internal readonly record struct MousePoint(int X, int Y);
internal enum MouseButtonKind { Left, Middle }

internal static class BrowserUiScanner
{
    public static bool IsBrowserForegroundWindow()
    {
        var hwnd = NativeMethods.GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return false;
        NativeMethods.GetWindowThreadProcessId(hwnd, out var pid);
        try
        {
            using var process = Process.GetProcessById((int)pid);
            return process.ProcessName.Equals("chrome", StringComparison.OrdinalIgnoreCase) ||
                   process.ProcessName.Equals("msedge", StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }


    public static List<TabHitTarget> Scan()
    {
        var windows = new List<IntPtr>();
        NativeMethods.EnumWindows((hwnd, _) =>
        {
            if (!NativeMethods.IsWindowVisible(hwnd)) return true;
            var className = new StringBuilder(256);
            NativeMethods.GetClassName(hwnd, className, className.Capacity);
            if (!className.ToString().StartsWith("Chrome_WidgetWin", StringComparison.OrdinalIgnoreCase)) return true;

            NativeMethods.GetWindowThreadProcessId(hwnd, out var pid);
            try
            {
                using var process = Process.GetProcessById((int)pid);
                var name = process.ProcessName;
                if (name.Equals("chrome", StringComparison.OrdinalIgnoreCase) ||
                    name.Equals("msedge", StringComparison.OrdinalIgnoreCase))
                    windows.Add(hwnd);
            }
            catch { }
            return true;
        }, IntPtr.Zero);

        var result = new List<TabHitTarget>();
        foreach (var hwnd in windows)
        {
            try
            {
                var root = AutomationElement.FromHandle(hwnd);
                if (root is null) continue;
                var tabs = root.FindAll(TreeScope.Descendants,
                    new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.TabItem));

                foreach (AutomationElement tab in tabs)
                {
                    try
                    {
                        // JTG writes this title prefix only while the hostname is locked.
                        // Filtering by the accessible tab name keeps the native helper in
                        // sync with the extension's saved global and per-site lock rules.
                        var tabName = tab.Current.Name ?? string.Empty;
                        if (!tabName.StartsWith("🔒", StringComparison.Ordinal)) continue;

                        var bounds = ToRectangle(tab.Current.BoundingRectangle);
                        if (bounds.Width < 32 || bounds.Height < 12 || tab.Current.IsOffscreen) continue;

                        var closeRect = FindCloseButton(tab, bounds);
                        if (closeRect.Width <= 0 || closeRect.Height <= 0) closeRect = GuessCloseButton(bounds);
                        bool isSelected = IsSelectedTab(tab);
                        result.Add(new TabHitTarget(hwnd, bounds, closeRect, isSelected));
                    }
                    catch (ElementNotAvailableException) { }
                    catch (InvalidOperationException) { }
                }
            }
            catch (ElementNotAvailableException) { }
            catch (COMException) { }
            catch (InvalidOperationException) { }
        }
        return result;
    }

    private static bool IsSelectedTab(AutomationElement tab)
    {
        try
        {
            if (tab.TryGetCurrentPattern(SelectionItemPattern.Pattern, out object patternObject) &&
                patternObject is SelectionItemPattern selection)
                return selection.Current.IsSelected;
        }
        catch (ElementNotAvailableException) { }
        catch (InvalidOperationException) { }
        catch (COMException) { }

        try { return tab.Current.HasKeyboardFocus; }
        catch { return false; }
    }

    private static Rectangle FindCloseButton(AutomationElement tab, Rectangle tabBounds)
    {
        var buttons = tab.FindAll(TreeScope.Descendants,
            new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button));
        Rectangle best = Rectangle.Empty;
        foreach (AutomationElement button in buttons)
        {
            try
            {
                var r = ToRectangle(button.Current.BoundingRectangle);
                if (r.Width < 8 || r.Height < 8 || r.Width > 44 || r.Height > 44) continue;
                if (r.Right > tabBounds.Right + 8 || r.Right < tabBounds.Right - 14) continue;
                if (r.Left < tabBounds.Left || r.Top < tabBounds.Top - 6 || r.Bottom > tabBounds.Bottom + 6) continue;

                // A compact button flush with the right edge of a TabItem is the close affordance.
                best = Rectangle.Union(best, r);
            }
            catch { }
        }
        return best;
    }

    private static Rectangle GuessCloseButton(Rectangle tab)
    {
        // Fallback for Chromium builds that expose the TabItem but not its close button
        // as a separate UI Automation element. This is intentionally limited to the tab's
        // rightmost close-button-sized area, not the whole tab.
        var width = Math.Max(14, Math.Min(26, tab.Width / 3));
        var height = Math.Min(26, tab.Height);
        return new Rectangle(tab.Right - width, tab.Top + Math.Max(0, (tab.Height - height) / 2), width, height);
    }

    private static Rectangle ToRectangle(System.Windows.Rect r)
    {
        if (r.IsEmpty || double.IsNaN(r.X) || double.IsNaN(r.Y) || r.Width <= 0 || r.Height <= 0)
            return Rectangle.Empty;
        return Rectangle.FromLTRB((int)Math.Floor(r.Left), (int)Math.Floor(r.Top),
            (int)Math.Ceiling(r.Right), (int)Math.Ceiling(r.Bottom));
    }
}

internal sealed class MouseHook : IDisposable
{
    private const int WhMouseLl = 14;
    private const int WmLButtonDown = 0x0201;
    private const int WmMButtonDown = 0x0207;
    private const uint LlmhfInjected = 0x00000001;
    private readonly Func<MousePoint, MouseButtonKind, bool> _onMouseDown;
    private readonly LowLevelMouseProcDelegate _callback;
    private IntPtr _hook;

    public MouseHook(Func<MousePoint, MouseButtonKind, bool> onMouseDown)
    {
        _onMouseDown = onMouseDown;
        _callback = HookCallback;
    }

    public void Install()
    {
        using var process = Process.GetCurrentProcess();
        using var module = process.MainModule!;
        _hook = NativeMethods.SetWindowsHookEx(WhMouseLl, _callback,
            NativeMethods.GetModuleHandle(module.ModuleName), 0);
        if (_hook == IntPtr.Zero)
            GuardApplicationContext.Log("WARNING: could not install the low-level mouse hook. Win32 error=" + Marshal.GetLastWin32Error());
    }

    private IntPtr HookCallback(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code >= 0)
        {
            try
            {
                var message = wParam.ToInt32();
                if (message == WmLButtonDown || message == WmMButtonDown)
                {
                    var data = Marshal.PtrToStructure<LowLevelMouseData>(lParam);
                    if ((data.Flags & LlmhfInjected) == 0)
                    {
                        var button = message == WmLButtonDown ? MouseButtonKind.Left : MouseButtonKind.Middle;
                        if (_onMouseDown(new MousePoint(data.Point.X, data.Point.Y), button))
                            return (IntPtr)1;
                    }
                }
            }
            catch (Exception ex) { GuardApplicationContext.Log("Mouse hook callback error: " + ex.Message); }
        }
        return NativeMethods.CallNextHookEx(_hook, code, wParam, lParam);
    }

    public static void ReplayClick(MousePoint point, MouseButtonKind button)
    {
        NativeMethods.SetCursorPos(point.X, point.Y);
        var down = button == MouseButtonKind.Left ? NativeMethods.MouseEventLeftDown : NativeMethods.MouseEventMiddleDown;
        var up = button == MouseButtonKind.Left ? NativeMethods.MouseEventLeftUp : NativeMethods.MouseEventMiddleUp;
        NativeMethods.mouse_event(down, 0, 0, 0, UIntPtr.Zero);
        NativeMethods.mouse_event(up, 0, 0, 0, UIntPtr.Zero);
    }

    public void Dispose()
    {
        if (_hook != IntPtr.Zero)
        {
            NativeMethods.UnhookWindowsHookEx(_hook);
            _hook = IntPtr.Zero;
        }
    }

    internal delegate IntPtr LowLevelMouseProcDelegate(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct NativePoint { public int X; public int Y; }
    [StructLayout(LayoutKind.Sequential)]
    private struct LowLevelMouseData
    {
        public NativePoint Point;
        public uint MouseData;
        public uint Flags;
        public uint Time;
        public IntPtr ExtraInfo;
    }
}

internal enum BrowserShortcut
{
    CtrlW,
    CtrlF4,
    CtrlShiftW,
    AltF4
}

internal sealed class KeyboardHook : IDisposable
{
    private const int WhKeyboardLl = 13;
    private const int WmKeyDown = 0x0100;
    private const int WmSysKeyDown = 0x0104;
    private const uint LlkhfInjected = 0x00000010;
    private readonly Func<BrowserShortcut, bool> _onShortcut;
    private readonly LowLevelKeyboardProcDelegate _callback;
    private IntPtr _hook;

    public KeyboardHook(Func<BrowserShortcut, bool> onShortcut)
    {
        _onShortcut = onShortcut;
        _callback = HookCallback;
    }

    public void Install()
    {
        using var process = Process.GetCurrentProcess();
        using var module = process.MainModule!;
        _hook = NativeMethods.SetWindowsHookEx(WhKeyboardLl, _callback,
            NativeMethods.GetModuleHandle(module.ModuleName), 0);
        if (_hook == IntPtr.Zero)
            GuardApplicationContext.Log("WARNING: could not install the low-level keyboard hook. Win32 error=" + Marshal.GetLastWin32Error());
    }

    private IntPtr HookCallback(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code >= 0 && (wParam.ToInt32() == WmKeyDown || wParam.ToInt32() == WmSysKeyDown))
        {
            try
            {
                var data = Marshal.PtrToStructure<LowLevelKeyboardData>(lParam);
                if ((data.Flags & LlkhfInjected) == 0)
                {
                    bool ctrl = (NativeMethods.GetAsyncKeyState(0x11) & 0x8000) != 0;
                    bool shift = (NativeMethods.GetAsyncKeyState(0x10) & 0x8000) != 0;
                    bool alt = (NativeMethods.GetAsyncKeyState(0x12) & 0x8000) != 0;
                    BrowserShortcut? action = null;

                    if (ctrl && data.VirtualKey == 0x57) action = shift ? BrowserShortcut.CtrlShiftW : BrowserShortcut.CtrlW;
                    else if (ctrl && data.VirtualKey == 0x73) action = BrowserShortcut.CtrlF4;
                    else if (alt && data.VirtualKey == 0x73) action = BrowserShortcut.AltF4;

                    if (action.HasValue && _onShortcut(action.Value)) return (IntPtr)1;
                }
            }
            catch (Exception ex) { GuardApplicationContext.Log("Keyboard hook callback error: " + ex.Message); }
        }
        return NativeMethods.CallNextHookEx(_hook, code, wParam, lParam);
    }

    public static void ReplayShortcut(BrowserShortcut shortcut)
    {
        switch (shortcut)
        {
            case BrowserShortcut.CtrlW:
                KeyDown(0x11); Tap(0x57); KeyUp(0x11); break;
            case BrowserShortcut.CtrlF4:
                KeyDown(0x11); Tap(0x73); KeyUp(0x11); break;
            case BrowserShortcut.CtrlShiftW:
                KeyDown(0x11); KeyDown(0x10); Tap(0x57); KeyUp(0x10); KeyUp(0x11); break;
            case BrowserShortcut.AltF4:
                KeyDown(0x12); Tap(0x73); KeyUp(0x12); break;
        }
    }

    private static void Tap(byte key) { KeyDown(key); KeyUp(key); }
    private static void KeyDown(byte key) => NativeMethods.keybd_event(key, 0, 0, UIntPtr.Zero);
    private static void KeyUp(byte key) => NativeMethods.keybd_event(key, 0, 0x0002, UIntPtr.Zero);

    public void Dispose()
    {
        if (_hook != IntPtr.Zero)
        {
            NativeMethods.UnhookWindowsHookEx(_hook);
            _hook = IntPtr.Zero;
        }
    }

    internal delegate IntPtr LowLevelKeyboardProcDelegate(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct LowLevelKeyboardData
    {
        public uint VirtualKey;
        public uint ScanCode;
        public uint Flags;
        public uint Time;
        public IntPtr ExtraInfo;
    }
}

internal static class NativeMethods
{
    internal const uint MouseEventLeftDown = 0x0002;
    internal const uint MouseEventLeftUp = 0x0004;
    internal const uint MouseEventMiddleDown = 0x0020;
    internal const uint MouseEventMiddleUp = 0x0040;

    internal delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("user32.dll")]
    internal static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    internal static extern int GetClassName(IntPtr hwnd, StringBuilder className, int maxCount);
    [DllImport("user32.dll")]
    internal static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")]
    internal static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    internal static extern IntPtr GetModuleHandle(string? moduleName);
    [DllImport("user32.dll", SetLastError = true)]
    internal static extern IntPtr SetWindowsHookEx(int idHook, MouseHook.LowLevelMouseProcDelegate hookProc, IntPtr hMod, uint threadId);
    [DllImport("user32.dll", SetLastError = true)]
    internal static extern IntPtr SetWindowsHookEx(int idHook, KeyboardHook.LowLevelKeyboardProcDelegate hookProc, IntPtr hMod, uint threadId);
    [DllImport("user32.dll", SetLastError = true)]
    internal static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")]
    internal static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")]
    internal static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")]
    internal static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    internal static extern short GetAsyncKeyState(int virtualKey);
    [DllImport("user32.dll")]
    internal static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extraInfo);
    [DllImport("user32.dll")]
    internal static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
}
