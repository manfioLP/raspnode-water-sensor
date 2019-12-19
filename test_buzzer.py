import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
BUZZER = 17
state = False
GPIO.setup(BUZZER, GPIO.OUT)

while True:
	print "lopping... buzzer state:", state
	state = not state
	GPIO.output(BUZZER, state)
	time.sleep(3)
