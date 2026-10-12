from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, Callable
from PIL import Image
import asyncio

class HairstylePipeline(ABC):
    """
    Abstract Interface for Hairstyle Synthesis Backends.
    Supports:
    - Hairstyle transfer from a reference hairstyle image
    - Color transfer (hex/RGB tint or color reference)
    - Progress callbacks for real-time SSE streaming
    - Asynchronous execution
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier of the pipeline backend."""
        pass

    @property
    @abstractmethod
    def memory_footprint_gb(self) -> float:
        """Estimated VRAM consumption in GB."""
        pass

    @abstractmethod
    async def run(
        self,
        person_image: Image.Image,
        reference_style_image: Optional[Image.Image] = None,
        color_hex: Optional[str] = None,
        color_reference_image: Optional[Image.Image] = None,
        progress_callback: Optional[Callable[[int, str], Any]] = None,
        **kwargs
    ) -> Image.Image:
        """
        Executes hairstyle transfer / color recolouring.
        
        Args:
            person_image: Target person photo.
            reference_style_image: Reference hairstyle cutout or photo.
            color_hex: Optional hex string tint (e.g. '#f59e0b').
            color_reference_image: Optional reference image for hair color extraction.
            progress_callback: async callback (percent: int, message: str)
            
        Returns:
            PIL Image of person with transferred hairstyle & color.
        """
        pass
