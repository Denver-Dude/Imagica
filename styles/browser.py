import sys, os, json
from PyQt5.QtCore import QUrl, Qt
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QTabWidget, QToolBar,
    QAction, QLineEdit, QStatusBar, QFileDialog, QShortcut
)
from PyQt5.QtWebEngineWidgets import (
    QWebEngineView, QWebEngineProfile, QWebEnginePage
)
from PyQt5.QtGui import QKeySequence
from PyQt5.QtWidgets import QCompleter
from PyQt5.QtCore import QStringListModel

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
EXT_DIR = os.path.join(BASE_DIR, "extensions")

HOME = QUrl.fromLocalFile(os.path.join(BASE_DIR, "new_tab.html"))
SEARCH = "https://www.google.com/search?q="

BOOKMARKS = os.path.join(DATA_DIR, "bookmarks.json")
HISTORY = os.path.join(DATA_DIR, "history.json")
SESSION = os.path.join(DATA_DIR, "session.json")

os.makedirs(DATA_DIR, exist_ok=True)

def load_json(path):
    if not os.path.exists(path):
        return []
    with open(path, "r") as f:
        return json.load(f)

def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

class BrowserTab(QWebEngineView):
    def __init__(self, profile):
        super().__init__()
        self.setPage(QWebEnginePage(profile, self))
        self.setContextMenuPolicy(Qt.DefaultContextMenu)

class Browser(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Subject")
        self.resize(1300, 850)

        self.profile = QWebEngineProfile("SubjectProfile", self)
        self.profile.setPersistentCookiesPolicy(QWebEngineProfile.ForcePersistentCookies)
        self.profile.setCachePath(DATA_DIR)
        self.profile.setPersistentStoragePath(DATA_DIR)
        self.profile.downloadRequested.connect(self.download_handler)

        self.tabs = QTabWidget()
        self.tabs.setDocumentMode(True)
        self.tabs.setTabsClosable(True)
        self.tabs.tabCloseRequested.connect(self.tabs.removeTab)
        self.tabs.currentChanged.connect(self.sync_ui)
        self.tabs.tabBarDoubleClicked.connect(self.new_tab)
        self.setCentralWidget(self.tabs)

        self.setStatusBar(QStatusBar())
        self.toolbar()
        self.shortcuts()
        self.omnibox()

        self.restore_session()

    # ---------------- UI ----------------
    def toolbar(self):
        tb = QToolBar()
        tb.setMovable(False)
        self.addToolBar(tb)

        tb.addAction(self.btn("◀", lambda: self.current().back()))
        tb.addAction(self.btn("▶", lambda: self.current().forward()))
        tb.addAction(self.btn("⟳", lambda: self.current().reload()))
        tb.addAction(self.btn("⌂", lambda: self.current().setUrl(HOME)))

        self.urlbar = QLineEdit()
        self.urlbar.setPlaceholderText("Search or enter address")
        self.urlbar.returnPressed.connect(self.navigate)
        tb.addWidget(self.urlbar)

        tb.addAction(self.btn("⭐", self.add_bookmark))
        tb.addAction(self.btn("Dev", self.devtools))

    def btn(self, text, fn):
        a = QAction(text, self)
        a.triggered.connect(fn)
        return a

    # ---------------- Tabs ----------------
    def new_tab(self, i=-1, url=None):
        if i != -1:
            return
        tab = BrowserTab(self.profile)
        tab.setUrl(url or HOME)

        idx = self.tabs.addTab(tab, "New Tab")
        self.tabs.setCurrentIndex(idx)

        tab.urlChanged.connect(lambda q, t=tab: self.handle_url(q, t))
        tab.loadFinished.connect(lambda _: self.load_extensions(tab))
        tab.page().featurePermissionRequested.connect(self.allow_permissions)

    def current(self):
        return self.tabs.currentWidget()

    def sync_ui(self):
        if self.current():
            self.urlbar.setText(self.current().url().toString())

    # ---------------- Navigation ----------------
    def navigate(self):
        text = self.urlbar.text().strip()
        if "://" not in text and "." not in text:
            url = SEARCH + text
        else:
            if not text.startswith(("http://", "https://")):
                text = "http://" + text
            url = text
        self.current().setUrl(QUrl(url))

    def handle_url(self, qurl, tab):
        if qurl.scheme() == "subject":
            query = qurl.path().replace("/search/", "")
            tab.setUrl(QUrl(SEARCH + query))
            return

        self.urlbar.setText(qurl.toString())
        history = load_json(HISTORY)
        history.append(qurl.toString())
        save_json(HISTORY, history[-500:])

    # ---------------- Downloads ----------------
    def download_handler(self, download):
        path, _ = QFileDialog.getSaveFileName(
            self, "Save File", download.path()
        )
        if path:
            download.setPath(path)
            download.accept()

    # ---------------- Permissions ----------------
    def allow_permissions(self, url, feature):
        self.sender().setFeaturePermission(
            url, feature, QWebEnginePage.PermissionGrantedByUser
        )

    # ---------------- Bookmarks ----------------
    def add_bookmark(self):
        data = load_json(BOOKMARKS)
        data.append({
            "title": self.current().page().title(),
            "url": self.current().url().toString()
        })
        save_json(BOOKMARKS, data)

    # ---------------- DevTools ----------------
    def devtools(self):
        dev = QWebEngineView()
        self.current().page().setDevToolsPage(dev.page())
        dev.resize(900, 700)
        dev.show()

    # ---------------- Extensions ----------------
    def load_extensions(self, tab):
        if not os.path.exists(EXT_DIR):
            return
        for ext in os.listdir(EXT_DIR):
            js = os.path.join(EXT_DIR, ext, "inject.js")
            if os.path.exists(js):
                with open(js) as f:
                    tab.page().runJavaScript(f.read())

    # ---------------- Omnibox ----------------
    def omnibox(self):
        self.model = QStringListModel()
        self.completer = QCompleter(self.model)
        self.urlbar.setCompleter(self.completer)
        self.urlbar.textEdited.connect(self.update_suggestions)

    def update_suggestions(self, text):
        s = set(load_json(HISTORY))
        for b in load_json(BOOKMARKS):
            s.add(b["url"])
        self.model.setStringList(
            [u for u in s if text.lower() in u.lower()][:10]
        )

    # ---------------- Shortcuts ----------------
    def shortcuts(self):
        QShortcut(QKeySequence("Ctrl+T"), self, activated=self.new_tab)
        QShortcut(QKeySequence("Ctrl+W"), self, activated=lambda: self.tabs.removeTab(self.tabs.currentIndex()))
        QShortcut(QKeySequence("Ctrl+L"), self, activated=self.urlbar.setFocus)
        QShortcut(QKeySequence("Ctrl+R"), self, activated=lambda: self.current().reload())

    # ---------------- Session ----------------
    def restore_session(self):
        urls = load_json(SESSION)
        if urls:
            for u in urls:
                self.new_tab(url=QUrl(u))
        else:
            self.new_tab()

    def closeEvent(self, e):
        save_json(SESSION, [
            self.tabs.widget(i).url().toString()
            for i in range(self.tabs.count())
        ])
        e.accept()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setApplicationName("Subject")
    Browser().show()
    sys.exit(app.exec_())
