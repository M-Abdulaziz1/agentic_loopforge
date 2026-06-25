import api.loopforge


def test_package_imports() -> None:
    assert api.loopforge.__version__ == "0.1.0"
