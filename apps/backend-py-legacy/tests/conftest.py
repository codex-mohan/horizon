import pytest
from dotenv import load_dotenv


# Load environment variables at the start of the test session
load_dotenv()


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"
