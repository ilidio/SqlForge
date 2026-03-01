import pytest
import ai_utils

@pytest.fixture(scope="session")
def ai_config():
    """
    Returns the configured Gemini API key and model.
    """
    return ai_utils.get_ai_config()

@pytest.fixture
def skip_if_no_ai():
    """
    Skips the test if AI is not configured.
    """
    if not ai_utils.is_ai_enabled():
        pytest.skip("Gemini AI is not configured. Run ./configure_gemini.sh first.")
